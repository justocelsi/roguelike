/**
 * El motor. Un reducer puro: (State, Action) => State.
 *
 * Sin atributos, sin niveles, sin XP. Una sola barra de vida y cinco acciones.
 * La dificultad no sale de los números sino de leer lo que el enemigo avisa
 * que va a hacer y decidir si pegás o te cubrís.
 *
 * El movimiento no pasa por acá: el pasillo lo maneja el renderer y sólo
 * dispara eventos discretos (entrar a un aula). El reducer no sabe de píxeles.
 */

import { ARMAS, ENEMIGOS, ITEMS, ITEM_IDS, MATERIAS, MATERIA_IDS, nombreMateria } from "./content";
import { generarPasillo, type Mundo } from "./mundo";
import { DEFECTOS, DEFECTO_IDS, PODERES, PODER_IDS } from "./poderes";
import { makeRng, pick, pickMany, random, randomSeed, type Rng } from "./rng";
import type {
  Accion,
  Action,
  Defecto,
  Efecto,
  Entrada,
  Jugador,
  State,
} from "./types";

export const CICLOS = 5;
export const VIDA_BASE = 45;
/** Daño del ataque a mano limpia. Fijo: no hay stats que lo escalen. */
export const DAÑO_ATAQUE = 12;
/**
 * Cubrirte justo cuando venía el golpe no sólo lo amortigua: contraatacás.
 * Sin esto, leer bien el aviso te costaba la mitad de tu daño y esperar era
 * siempre una pérdida.
 */
export const DAÑO_CONTRA = 15;
const DURACION_EFECTO = 2;

/** El colegio empeora por ciclo. Sin esto, el ciclo 5 sería igual que el 1. */
const EV = Number(process.env.NEXT_PUBLIC_EV ?? 0.1);
const ED = Number(process.env.NEXT_PUBLIC_ED ?? 0.04);

export function escalaVida(state: State): number {
  return 1 + (state.ciclo - 1) * EV;
}
export function escalaDaño(state: State): number {
  return 1 + (state.ciclo - 1) * ED;
}

// --- interceptores --------------------------------------------------------

export function defectosActivos(state: State): Defecto[] {
  return state.jugador.defectos.map((id) => DEFECTOS[id]);
}

export function puedeHuir(state: State): boolean {
  if (state.combate && ENEMIGOS[state.combate.enemigoId].profesor) return false;
  return !defectosActivos(state).some((d) => d.sinHuida);
}

function duracionEfecto(state: State): number {
  return (
    DURACION_EFECTO + (defectosActivos(state).some((d) => d.efectosLargos) ? 1 : 0)
  );
}

export function tieneEfecto(state: State, e: Efecto): boolean {
  return state.efectos.some((x) => x.efecto === e);
}

export function confundido(state: State): boolean {
  return tieneEfecto(state, "confusion");
}

export function nombreDe(state: State, materiaId: string): string {
  return nombreMateria(materiaId, state.deformacion[materiaId] ?? 0);
}

// --- helpers --------------------------------------------------------------

function log(
  entradas: Entrada[],
  texto: string,
  tipo: Entrada["tipo"] = "neutral",
): Entrada[] {
  return [{ texto, tipo }, ...entradas].slice(0, 30);
}

function aplicarDaño(state: State, base: number): number {
  let d = base;
  for (const def of defectosActivos(state)) if (def.daño) d = def.daño(d);
  return Math.max(1, Math.round(d));
}

function aplicarRecibido(state: State, base: number): number {
  let d = base;
  for (const def of defectosActivos(state)) if (def.recibido) d = def.recibido(d);
  return Math.max(1, Math.round(d));
}

function vidaMaxima(state: State, base: number): number {
  let v = base;
  for (const d of defectosActivos(state)) if (d.vidaMax) v = d.vidaMax(v);
  return v;
}

function nuevoPasillo(state: State, rng: Rng): Mundo {
  const menos = defectosActivos(state).some((d) => d.menosPuertas);
  return generarPasillo(rng, {
    cantidadPuertas: menos ? 3 : 5,
    deformacion: state.deformacion,
  });
}

function generarOferta(state: State, rng: Rng) {
  const poderesLibres = PODER_IDS.filter(
    (p) => !state.jugador.poderes.some((x) => x.id === p),
  );
  const defectosLibres = DEFECTO_IDS.filter(
    (d) => !state.jugador.defectos.includes(d),
  );
  const poderes = pickMany(rng, poderesLibres, 3);
  const defectos = pickMany(rng, defectosLibres, 3);
  return poderes.map((poderId, i) => ({
    poderId,
    defectoId: defectos[i] ?? defectosLibres[0] ?? DEFECTO_IDS[0],
  }));
}

/** Cada ciclo el colegio se corrompe un escalón más. */
function deformar(state: State, rng: Rng): State {
  const objetivos = pickMany(rng, MATERIA_IDS, 2);
  const deformacion = { ...state.deformacion };
  let l = state.log;
  for (const m of objetivos) {
    const antes = deformacion[m] ?? 0;
    if (antes >= 3) continue;
    deformacion[m] = antes + 1;
    if (antes + 1 >= 2) {
      l = log(
        l,
        `Donde decía ${nombreMateria(m, antes)} ahora dice ${nombreMateria(m, antes + 1)}.`,
        "sueño",
      );
    }
  }
  return { ...state, deformacion, log: l };
}

function despertar(state: State, rng: Rng): State {
  const ciclo = state.ciclo + 1;
  if (ciclo > CICLOS) {
    return {
      ...state,
      fase: "fin",
      mundo: null,
      final:
        "Saliste al patio y estaba amaneciendo de verdad. Dormiste catorce horas. Cuando te despertaste no te acordabas de nada, y eso fue lo peor.",
    };
  }
  const deformado = deformar({ ...state, ciclo }, rng);
  const base: State = {
    ...deformado,
    fase: "pasillo",
    oferta: [],
    efectos: [],
    log: log(deformado.log, "Te despertás. El pasillo es más largo.", "malo"),
  };
  return { ...base, mundo: nuevoPasillo(base, rng) };
}

// --- combate --------------------------------------------------------------

const TEXTO_EFECTO: Record<Efecto, string> = {
  confusion: "Dejás de entender lo que estás mirando.",
  miedo: "Se te va la mano al costado. No responde.",
  torpeza: "El cuerpo te llega tarde.",
};

function turnoEnemigo(state: State, rng: Rng): State {
  const c = state.combate;
  if (!c) return state;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  let s = state;

  let contra = 0;
  if (intencion.tipo === "golpe") {
    let daño = aplicarRecibido(s, (intencion.daño ?? 0) * escalaDaño(s));
    if (c.esperando) {
      daño = Math.max(1, Math.round(daño * 0.2));
      contra = aplicarDaño(s, DAÑO_CONTRA);
      s = {
        ...s,
        log: log(
          s.log,
          `Lo viste venir. Entran ${daño} y le devolvés ${contra}.`,
          "bueno",
        ),
      };
    } else {
      s = { ...s, log: log(s.log, `Te alcanza de lleno. ${daño}.`, "malo") };
    }
    s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - daño } };
  } else if (intencion.tipo === "efecto" && intencion.efecto) {
    const ef = intencion.efecto;
    const ya = s.efectos.some((x) => x.efecto === ef);
    s = {
      ...s,
      efectos: ya
        ? s.efectos.map((x) => (x.efecto === ef ? { ...x, turnos: duracionEfecto(s) } : x))
        : [...s.efectos, { efecto: ef, turnos: duracionEfecto(s) }],
      log: log(s.log, TEXTO_EFECTO[ef], "enemigo"),
    };
  }

  return {
    ...s,
    combate: {
      ...c,
      vida: s.combate!.vida - contra,
      paso: c.paso + 1,
      esperando: false,
    },
  };
}

function cerrarTurno(state: State, rng: Rng): State {
  let s = turnoEnemigo(state, rng);
  if (tieneEfecto(s, "torpeza") && s.jugador.vida > 0) {
    s = { ...s, log: log(s.log, "Todavía no terminaste de moverte.", "enemigo") };
    s = turnoEnemigo(s, rng);
  }
  s = {
    ...s,
    efectos: s.efectos.map((e) => ({ ...e, turnos: e.turnos - 1 })).filter((e) => e.turnos > 0),
  };

  if (s.jugador.vida <= 0) {
    return {
      ...s,
      jugador: { ...s.jugador, vida: 0 },
      fase: "muerto",
      combate: null,
      mundo: null,
      final: "No sonó ningún timbre.",
    };
  }
  // El contraataque puede haber sido el golpe final.
  if (s.combate && s.combate.vida <= 0) return ganarCombate(s, rng);
  return s;
}

function ganarCombate(state: State, rng: Rng): State {
  const c = state.combate!;
  const enemigo = ENEMIGOS[c.enemigoId];
  const materia = MATERIAS[c.materiaId];
  let jugador: Jugador = {
    ...state.jugador,
    sombras: [...state.jugador.sombras, enemigo.id],
  };
  let l = log(state.log, `${enemigo.nombre} deja de estar.`, "bueno");

  if (enemigo.profesor) {
    // Vencer a un profesor es la única progresión permanente que hay.
    const nuevaMax = vidaMaxima(state, state.jugador.vidaMax + 6);
    jugador = { ...jugador, vidaMax: nuevaMax, vida: nuevaMax };
    l = log(l, "Aguantás un poco más que antes. +6 de vida máxima.", "bueno");
  } else if (materia && random(rng) < 0.45) {
    const armaId = pick(rng, materia.armas);
    jugador = { ...jugador, armaId, armaUsos: ARMAS[armaId].usos };
    l = log(l, `Agarrás ${ARMAS[armaId].nombre}. ${ARMAS[armaId].usos} usos.`, "bueno");
  } else if (jugador.items.length < 5) {
    const itemId = pick(rng, ITEM_IDS);
    jugador = { ...jugador, items: [...jugador.items, itemId] };
    l = log(l, `Guardás ${ITEMS[itemId].nombre}.`, "bueno");
  }

  return {
    ...state,
    jugador,
    combate: null,
    efectos: [],
    fase: "recompensa",
    cicloTerminado: !!enemigo.profesor,
    log: l,
  };
}

// --- estado inicial -------------------------------------------------------

export function initialState(seed: number = randomSeed()): State {
  const rng = makeRng(seed);
  const jugador: Jugador = {
    vida: VIDA_BASE,
    vidaMax: VIDA_BASE,
    armaId: null,
    armaUsos: 0,
    items: ["agua"],
    sombras: [],
    poderes: [],
    defectos: [],
  };
  const base: State = {
    seed,
    ciclo: 1,
    fase: "pasillo",
    jugador,
    mundo: null,
    combate: null,
    efectos: [],
    deformacion: Object.fromEntries(MATERIA_IDS.map((m) => [m, 0])),
    cicloTerminado: false,
    oferta: [],
    log: [{ texto: "Hace tres días que no dormís bien. Sonó el timbre.", tipo: "neutral" }],
    final: null,
  };
  return { ...base, mundo: nuevoPasillo(base, rng), seed: rng.seed };
}

// --- reducer --------------------------------------------------------------

export function reduce(state: State, action: Action): State {
  if (action.type === "reiniciar") return initialState(action.seed);
  const rng = makeRng(state.seed);
  const next = apply(state, action, rng);
  return { ...next, seed: rng.seed };
}

function apply(state: State, action: Action, rng: Rng): State {
  switch (action.type) {
    case "entrar-aula": {
      if (state.fase !== "pasillo" || !state.mundo) return state;
      const puerta = state.mundo.puertas.find(
        (p) => p.x === action.puertaX && p.y === action.puertaY,
      );
      if (!puerta || puerta.usada) return state;
      const enemigo = ENEMIGOS[puerta.sorteado];
      const vidaEnemigo = Math.round(enemigo.vida * escalaVida(state));

      const mundo: Mundo = {
        ...state.mundo,
        puertas: state.mundo.puertas.map((p) =>
          p === puerta ? { ...p, usada: true } : p,
        ),
      };

      return {
        ...state,
        fase: "combate",
        mundo,
        efectos: [],
        // Entrás entero: cada combate es un desafío letal autocontenido, no
        // una carrera de desgaste por el pasillo.
        jugador: { ...state.jugador, vida: state.jugador.vidaMax },
        combate: {
          enemigoId: enemigo.id,
          materiaId: puerta.materiaId,
          vida: vidaEnemigo,
          vidaMax: vidaEnemigo,
          paso: 0,
          esperando: false,
        },
        log: log(
          state.log,
          enemigo.profesor
            ? `Adentro está ${enemigo.nombre}. La puerta no abre para atrás.`
            : `${nombreDe(state, puerta.materiaId)}. Hay ${enemigo.nombre}.`,
          enemigo.profesor ? "malo" : "neutral",
        ),
      };
    }

    case "combate":
      return turnoDeCombate(state, action.accion, action.ref, rng);

    case "seguir": {
      if (state.fase !== "recompensa") return state;
      // Si lo que cayó era un profesor, se termina el ciclo y se duerme.
      return volverAlPasillo(state, rng, state.cicloTerminado);
    }

    case "aceptar-oferta": {
      if (state.fase !== "sueño") return state;
      const par = state.oferta[action.index];
      if (!par) return state;
      const poder = PODERES[par.poderId];
      const defecto = DEFECTOS[par.defectoId];
      const jugador: Jugador = {
        ...state.jugador,
        poderes: [...state.jugador.poderes, { id: poder.id, usos: poder.usos }],
        defectos: [...state.jugador.defectos, defecto.id],
      };
      const aceptado: State = {
        ...state,
        jugador,
        log: log(
          log(state.log, `${poder.nombre}. ${poder.texto}`, "sueño"),
          `El precio: ${defecto.nombre}. ${defecto.texto}`, "malo",
        ),
      };
      return despertar(aceptado, rng);
    }

    default:
      return state;
  }
}

function volverAlPasillo(state: State, rng: Rng, forzarSueño: boolean): State {
  if (forzarSueño) {
    return {
      ...state,
      fase: "sueño",
      mundo: null,
      cicloTerminado: false,
      oferta: generarOferta(state, rng),
      log: log(state.log, "Te sentás en el pasillo y por fin te dormís.", "sueño"),
    };
  }
  return { ...state, fase: "pasillo" };
}

function turnoDeCombate(
  state: State,
  accion: Accion,
  ref: string | undefined,
  rng: Rng,
): State {
  if (state.fase !== "combate" || !state.combate) return state;
  const c = state.combate;
  let s = state;

  if (accion === "huir") {
    if (!puedeHuir(s)) return s;
    return {
      ...s,
      fase: "pasillo",
      combate: null,
      efectos: [],
      log: log(s.log, "Salís al pasillo. No mirás atrás.", "neutral"),
    };
  }

  // El miedo puede hacer que la acción no salga.
  if (tieneEfecto(s, "miedo") && random(rng) < 0.3) {
    s = { ...s, log: log(s.log, "No te sale. Te quedás duro.", "malo") };
    return cerrarTurno(s, rng);
  }

  let vidaEnemigo = c.vida;
  let esperando = false;

  switch (accion) {
    case "atacar": {
      const d = aplicarDaño(s, DAÑO_ATAQUE);
      vidaEnemigo -= d;
      s = { ...s, log: log(s.log, `Le pegás. ${d}.`, "neutral") };
      break;
    }
    case "esperar": {
      esperando = true;
      s = { ...s, log: log(s.log, "Te cubrís y esperás.", "neutral") };
      break;
    }
    case "arma": {
      if (!s.jugador.armaId || s.jugador.armaUsos <= 0) return s;
      const arma = ARMAS[s.jugador.armaId];
      const d = aplicarDaño(s, arma.daño);
      vidaEnemigo -= d;
      const usos = s.jugador.armaUsos - 1;
      s = {
        ...s,
        jugador: {
          ...s.jugador,
          armaUsos: usos,
          armaId: usos > 0 ? s.jugador.armaId : null,
        },
        log: log(
          s.log,
          usos > 0 ? `${arma.texto} ${d}.` : `${arma.texto} ${d}. Y se rompe.`,
          usos > 0 ? "bueno" : "malo",
        ),
      };
      break;
    }
    case "usar": {
      if (!ref) return s;
      if (ref.startsWith("sombra:")) {
        const id = ref.slice(7);
        const i = s.jugador.sombras.indexOf(id);
        if (i === -1) return s;
        s = {
          ...s,
          jugador: { ...s.jugador, sombras: s.jugador.sombras.filter((_, k) => k !== i) },
          efectos: [],
          log: log(s.log, `La sombra de ${ENEMIGOS[id].nombre} se interpone.`, "bueno"),
        };
        break;
      }
      if (ref.startsWith("poder:")) {
        const id = ref.slice(6);
        const tiene = s.jugador.poderes.find((p) => p.id === id);
        if (!tiene || tiene.usos <= 0) return s;
        const poder = PODERES[id];
        let j = {
          ...s.jugador,
          poderes: s.jugador.poderes.map((p) =>
            p.id === id ? { ...p, usos: p.usos - 1 } : p,
          ),
        };
        if (poder.efecto.daño) vidaEnemigo -= aplicarDaño(s, poder.efecto.daño);
        if (poder.efecto.vida) j = { ...j, vida: Math.min(j.vidaMax, j.vida + poder.efecto.vida) };
        s = {
          ...s,
          jugador: j,
          efectos: poder.efecto.limpia ? [] : s.efectos,
          log: log(s.log, `${poder.nombre}.`, "sueño"),
        };
        break;
      }
      const idx = s.jugador.items.indexOf(ref);
      if (idx === -1) return s;
      const item = ITEMS[ref];
      let j = { ...s.jugador, items: s.jugador.items.filter((_, k) => k !== idx) };
      if (item.efecto.vida) j = { ...j, vida: Math.min(j.vidaMax, j.vida + item.efecto.vida) };
      if (item.efecto.daño) vidaEnemigo -= aplicarDaño(s, item.efecto.daño);
      s = {
        ...s,
        jugador: j,
        efectos: item.efecto.limpia ? [] : s.efectos,
        log: log(s.log, `Usás ${item.nombre}.`, "neutral"),
      };
      break;
    }
  }

  s = { ...s, combate: { ...s.combate!, vida: vidaEnemigo, esperando } };
  if (vidaEnemigo <= 0) return ganarCombate(s, rng);
  return cerrarTurno(s, rng);
}
