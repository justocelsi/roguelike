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

/**
 * Nada acierta siempre, de ningún lado. La regla que mantiene esto justo es
 * que el número esté siempre a la vista: el azar escondido se siente tramposo,
 * el azar declarado es una apuesta que tomó el jugador.
 *
 * Las dos acciones que premian leer bien el aviso son las que mejor apuntan.
 */
export const PRECISION_ATAQUE = 0.92;
export const PRECISION_CONTRA = 0.9;
/** Ningún arma baja de acá por más gastada que esté. */
const PRECISION_MINIMA = 0.35;

/** Con miedo encima, esta parte de las acciones no sale directamente. */
export const FALLA_POR_MIEDO = 0.3;

/**
 * El miedo se multiplica con la precisión de lo que uses: primero tira si la
 * acción sale, después si acierta. La interfaz muestra el producto, no los
 * factores, porque es lo que al jugador le importa.
 */
export function factorMiedo(state: State): number {
  return tieneEfecto(state, "miedo") ? 1 - FALLA_POR_MIEDO : 1;
}

/** Precisión actual del arma: el filo se pierde con el uso. */
export function precisionArma(state: State): number {
  const j = state.jugador;
  if (!j.armaId) return 0;
  const arma = ARMAS[j.armaId];
  const usados = arma.usos - j.armaUsos;
  return Math.max(PRECISION_MINIMA, arma.precision - usados * arma.desgaste);
}
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
  actor?: Entrada["actor"],
  extra?: { icono?: Efecto; aviso?: boolean },
): Entrada[] {
  return [{ texto, tipo, actor, ...extra }, ...entradas].slice(0, 30);
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
  /** Marca de agua: todo lo que se loguee de acá en más lo hizo el enemigo. */
  const tope = state.log[0];

  let contra = 0;
  const acierta = random(rng) <= (intencion.precision ?? 0.85);
  /** Te cubriste: aunque no te toque, quedaste parado para devolver. */
  const devolver = () => {
    if (!c.esperando) return;
    contra = aplicarDaño(s, DAÑO_CONTRA);
    if (random(rng) > PRECISION_CONTRA) {
      contra = 0;
      s = { ...s, log: log(s.log, "Tirás a devolver y no llegás.", "neutral") };
    } else {
      s = { ...s, log: log(s.log, `Se abrió. Le devolvés ${contra}.`, "bueno") };
    }
  };

  if (intencion.tipo === "golpe") {
    if (!acierta) {
      s = { ...s, log: log(s.log, "Va hacia vos y pasa de largo.", "neutral") };
      devolver();
    } else {
      // Primero qué hizo, después qué te costó: son dos eventos distintos y la
      // interfaz los muestra uno después del otro.
      let daño = aplicarRecibido(s, (intencion.daño ?? 0) * escalaDaño(s));
      s = { ...s, log: log(s.log, intencion.impacto ?? "Te alcanza.", "enemigo") };
      if (c.esperando) {
        daño = Math.max(1, Math.round(daño * 0.2));
        s = { ...s, log: log(s.log, `Lo viste venir: sólo −${daño}.`, "bueno") };
        devolver();
      } else {
        s = { ...s, log: log(s.log, `De lleno. −${daño}.`, "malo") };
      }
      s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - daño } };
    }
  } else if (intencion.tipo === "efecto" && intencion.efecto) {
    if (!acierta) {
      s = { ...s, log: log(s.log, "Lo intenta y no te agarra.", "neutral") };
    } else {
      const ef = intencion.efecto;
      const ya = s.efectos.some((x) => x.efecto === ef);
      s = {
        ...s,
        efectos: ya
          ? s.efectos.map((x) => (x.efecto === ef ? { ...x, turnos: duracionEfecto(s) } : x))
          : [...s.efectos, { efecto: ef, turnos: duracionEfecto(s) }],
        log: log(s.log, TEXTO_EFECTO[ef], "enemigo", undefined, { icono: ef }),
      };
    }
  } else {
    // Un turno de espera igual es un turno: si no se muestra, el jugador ve
    // su acción y después el aviso, y parece que el enemigo se la saltó.
    s = { ...s, log: log(s.log, "No hace nada. Todavía.", "neutral") };
  }

  // Todo lo agregado en este turno lleva la firma del enemigo.
  const corte = tope ? s.log.indexOf(tope) : s.log.length;
  const firmado = s.log.map((e, i) =>
    i < (corte === -1 ? s.log.length : corte) ? { ...e, actor: "eso" as const } : e,
  );

  return {
    ...s,
    log: firmado,
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
    // Sigue siendo el turno del enemigo: va firmado como suyo para que la
    // pausa larga caiga antes de esta línea y no en el medio.
    s = {
      ...s,
      log: log(s.log, "Todavía no terminaste de moverte.", "enemigo", "eso"),
    };
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

  // Recién ahora el enemigo decide lo próximo, y lo muestra. Este beat es lo
  // único que el jugador necesita para elegir su turno, así que tiene que
  // existir como evento y no cambiar en silencio arriba de la pantalla.
  if (s.combate) {
    const e = ENEMIGOS[s.combate.enemigoId];
    const proxima = e.patron[s.combate.paso % e.patron.length];
    s = { ...s, log: log(s.log, proxima.tell, "enemigo", "eso", { aviso: true }) };
  }
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
        // Entrás, y lo primero que pasa es que ves qué va a hacer.
        log: log(
          log(
            state.log,
            enemigo.profesor
              ? `Adentro está ${enemigo.nombre}. La puerta no abre para atrás.`
              : `${nombreDe(state, puerta.materiaId)}. Hay ${enemigo.nombre}.`,
            enemigo.profesor ? "malo" : "neutral",
          ),
          enemigo.patron[0].tell,
          "enemigo",
          "eso",
          { aviso: true },
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
  if (tieneEfecto(s, "miedo") && random(rng) < FALLA_POR_MIEDO) {
    s = { ...s, log: log(s.log, "No te sale. Te quedás duro.", "malo") };
    return cerrarTurno(s, rng);
  }

  let vidaEnemigo = c.vida;
  let esperando = false;

  switch (accion) {
    case "atacar": {
      if (random(rng) > PRECISION_ATAQUE) {
        s = { ...s, log: log(s.log, "Tirás el brazo y no está donde creías.", "malo") };
        break;
      }
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
      // El uso se gasta aciertes o no: lo que se rompe es el arma, no el golpe.
      const usos = s.jugador.armaUsos - 1;
      const acierta = random(rng) <= precisionArma(s);
      const critico = acierta && random(rng) <= arma.critico;

      let texto: string;
      let tono: Entrada["tipo"];
      if (!acierta) {
        texto = `${arma.nombre} pasa al lado.`;
        tono = "malo";
      } else {
        const d = aplicarDaño(s, critico ? arma.daño * 2 : arma.daño);
        vidaEnemigo -= d;
        texto = critico ? `${arma.texto} Justo ahí. ${d}.` : `${arma.texto} ${d}.`;
        tono = "bueno";
      }
      if (usos <= 0) texto += " Y se rompe.";

      s = {
        ...s,
        jugador: {
          ...s.jugador,
          armaUsos: usos,
          armaId: usos > 0 ? s.jugador.armaId : null,
        },
        log: log(s.log, texto, usos <= 0 ? "malo" : tono),
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
        const j0 = {
          ...s.jugador,
          poderes: s.jugador.poderes.map((p) =>
            p.id === id ? { ...p, usos: p.usos - 1 } : p,
          ),
        };
        if (random(rng) > poder.precision) {
          s = {
            ...s,
            jugador: j0,
            log: log(s.log, `${poder.nombre} no llega a agarrar.`, "malo"),
          };
          break;
        }
        let j = j0;
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
      // El item se gasta igual: temblar y que se te caiga también cuenta.
      const j0 = { ...s.jugador, items: s.jugador.items.filter((_, k) => k !== idx) };
      if (random(rng) > item.precision) {
        s = {
          ...s,
          jugador: j0,
          log: log(s.log, `${item.nombre} se te cae. Se pierde.`, "malo"),
        };
        break;
      }
      let j = j0;
      if (item.efecto.vida) j = { ...j, vida: Math.min(j.vidaMax, j.vida + item.efecto.vida) };
      if (item.efecto.daño) vidaEnemigo -= aplicarDaño(s, item.efecto.daño);
      s = {
        ...s,
        jugador: j,
        efectos: item.efecto.limpia ? [] : s.efectos,
        log: log(s.log, `Usás ${item.nombre}.`, "bueno"),
      };
      break;
    }
  }

  s = { ...s, combate: { ...s.combate!, vida: vidaEnemigo, esperando } };
  if (vidaEnemigo <= 0) return ganarCombate(s, rng);
  return cerrarTurno(s, rng);
}
