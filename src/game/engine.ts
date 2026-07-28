/**
 * El motor. Un reducer puro: (State, Action) => State.
 *
 * Sin React y sin DOM. Todo el azar pasa por el RNG sembrado que vive en el
 * propio estado, así que una run entera es reproducible desde su semilla.
 *
 * Los defectos no están cableados: el motor los consulta como interceptores en
 * cada punto donde toma una decisión.
 */

import {
  ARMAS,
  ENEMIGOS,
  ITEMS,
  ITEM_IDS,
  MATERIAS,
  MATERIA_IDS,
  nombreMateria,
} from "./content";
import { DEFECTOS, DEFECTO_IDS, PODERES, PODER_IDS } from "./poderes";
import { makeRng, pick, pickMany, randInt, random, randomSeed, type Rng } from "./rng";
import type {
  Accion,
  Action,
  Atributo,
  Aula,
  Defecto,
  Efecto,
  Entrada,
  Jugador,
  State,
} from "./types";

export const AULAS_POR_CICLO = 6;
export const CICLOS = 5;
export const VIDA_BASE = 40;
export const ATRIBUTO_BASE = 4;
/** Turnos que dura un efecto al aplicarse. */
const DURACION_EFECTO = 2;
/**
 * El colegio se pone peor a la par tuya. Sin esto, subir de nivel volvería la
 * run cada vez más fácil y el ciclo 5 sería más blando que el 1.
 */
export function escala(state: State): number {
  return 1 + (state.ciclo - 1) * ESCALA_VIDA;
}

/**
 * El daño escala mucho más despacio que la vida: así las peleas tardías son
 * más largas y tensas en vez de matarte de dos golpes.
 */
export function escalaDaño(state: State): number {
  return 1 + (state.ciclo - 1) * ESCALA_DAÑO;
}

/** Perillas de balance. Se afinan jugando; el env sólo se usa para simular. */
export const ESCALA_VIDA = Number(process.env.NEXT_PUBLIC_ESCALA_VIDA ?? 0.3);
export const ESCALA_DAÑO = Number(process.env.NEXT_PUBLIC_ESCALA_DANO ?? 0.1);
export const MULT_DAÑO = Number(process.env.NEXT_PUBLIC_MULT_DANO ?? 1.0);

// --- interceptores --------------------------------------------------------

export function defectosActivos(state: State): Defecto[] {
  return state.jugador.defectos.map((id) => DEFECTOS[id]);
}

export function vidaMaxima(state: State): number {
  let v = VIDA_BASE + state.jugador.nivel * 6;
  for (const d of defectosActivos(state)) if (d.vidaMax) v = d.vidaMax(v);
  return v;
}

export function puedeHuir(state: State): boolean {
  return !defectosActivos(state).some((d) => d.sinHuida);
}

function aulasOfrecidas(state: State): number {
  return defectosActivos(state).some((d) => d.menosAulas) ? 2 : 3;
}

function duracionEfecto(state: State): number {
  return (
    DURACION_EFECTO +
    (defectosActivos(state).some((d) => d.efectosLargos) ? 1 : 0)
  );
}

// --- consultas de estado --------------------------------------------------

export function tieneEfecto(state: State, e: Efecto): boolean {
  return state.efectos.some((x) => x.efecto === e);
}

/** La interfaz consulta esto para saber si tiene que mostrar los datos mal. */
export function confundido(state: State): boolean {
  return tieneEfecto(state, "confusion");
}

export function nombreDe(state: State, materiaId: string): string {
  return nombreMateria(materiaId, state.deformacion[materiaId] ?? 0);
}

/** El atributo que lastima una materia. Con deformación 3, cambia. */
export function atributoDe(state: State, materiaId: string): Atributo {
  const base = MATERIAS[materiaId].atributo;
  if ((state.deformacion[materiaId] ?? 0) < 3) return base;
  const rot: Record<Atributo, Atributo> = {
    conocimiento: "nervio",
    nervio: "reflejos",
    reflejos: "conocimiento",
  };
  return rot[base];
}

export function dañoDe(state: State, accion: Accion): number {
  const a = state.jugador.atributos;
  let base: number;
  switch (accion) {
    case "resolver":
      base = 5 + a.conocimiento * 1.6;
      break;
    case "esquivar":
      base = 2 + a.reflejos * 1.1;
      break;
    case "arma":
      base = state.jugador.armaId ? ARMAS[state.jugador.armaId].daño : 3;
      break;
    default:
      base = 0;
  }
  return Math.round(base);
}

// --- helpers internos -----------------------------------------------------

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

/** Genera la oferta de aulas del momento. */
function generarAulas(state: State, rng: Rng): Aula[] {
  const n = aulasOfrecidas(state);
  return Array.from({ length: n }, (_, i) => {
    const materiaId = pick(rng, MATERIA_IDS);
    const materia = MATERIAS[materiaId];
    const deform = state.deformacion[materiaId] ?? 0;

    // Deformación 1+: se cuelan enemigos de otra materia.
    const propios = materia.enemigos;
    const ajenos =
      deform >= 1
        ? MATERIAS[pick(rng, MATERIA_IDS.filter((m) => m !== materiaId))].enemigos
        : [];
    const pool = [...propios, ...(ajenos.length ? [pick(rng, ajenos)] : [])];

    const elegidos = pickMany(rng, pool, Math.min(3, pool.length));
    const pesos = elegidos.map(() => randInt(rng, 1, 5));
    const total = pesos.reduce((a, b) => a + b, 0);
    const lecturas = elegidos.map((enemigoId, k) => ({
      enemigoId,
      prob: pesos[k] / total,
    }));

    let roll = random(rng);
    let sorteado = lecturas[lecturas.length - 1].enemigoId;
    for (const l of lecturas) {
      roll -= l.prob;
      if (roll <= 0) {
        sorteado = l.enemigoId;
        break;
      }
    }

    return {
      id: `aula-${state.ciclo}-${state.aulasHechas}-${i}`,
      materiaId,
      lecturas,
      sorteado,
    };
  });
}

/** Arma la oferta del sueño: tres pares poder + defecto, sorteados aparte. */
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

function entrarAlSueño(state: State, rng: Rng): State {
  return {
    ...state,
    fase: "sueño",
    combate: null,
    efectos: [],
    oferta: generarOferta(state, rng),
    log: log(state.log, "Se te cierran los ojos. El pasillo sigue.", "sueño"),
  };
}

/** Cada ciclo el colegio se corrompe un escalón más. */
function deformar(state: State, rng: Rng): State {
  const objetivos = pickMany(rng, MATERIA_IDS, 2);
  const deformacion = { ...state.deformacion };
  const entradas: string[] = [];
  for (const m of objetivos) {
    const antes = deformacion[m] ?? 0;
    if (antes >= 3) continue;
    deformacion[m] = antes + 1;
    if (antes + 1 === 2) {
      entradas.push(
        `${NOMBRE_PREVIO(m, antes)} ahora dice ${nombreMateria(m, antes + 1)}.`,
      );
    } else if (antes + 1 === 3) {
      entradas.push(`${nombreMateria(m, 3)} ya no lastima donde lastimaba.`);
    }
  }
  let l = state.log;
  for (const e of entradas) l = log(l, e, "sueño");
  return { ...state, deformacion, log: l };
}

function NOMBRE_PREVIO(materiaId: string, deform: number): string {
  return nombreMateria(materiaId, deform);
}

function despertar(state: State, rng: Rng): State {
  const ciclo = state.ciclo + 1;
  if (ciclo > CICLOS) {
    return {
      ...state,
      fase: "fin",
      final:
        "Sonó el timbre y no había nadie más en el pasillo. Saliste. Nadie te vio salir.",
    };
  }
  const deformado = deformar({ ...state, ciclo, aulasHechas: 0 }, rng);
  const jugador = {
    ...deformado.jugador,
    vida: vidaMaxima(deformado),
    vidaMax: vidaMaxima(deformado),
  };
  const base: State = {
    ...deformado,
    jugador,
    fase: "eligiendo-aula",
    oferta: [],
    log: log(deformado.log, `Ciclo ${ciclo}. Algo cambió de lugar.`, "sueño"),
  };
  return { ...base, aulas: generarAulas(base, rng) };
}

// --- combate --------------------------------------------------------------

function turnoEnemigo(state: State, rng: Rng): State {
  const c = state.combate;
  if (!c) return state;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  let s = state;

  if (intencion.tipo === "golpe") {
    let daño = aplicarRecibido(s, (intencion.daño ?? 0) * MULT_DAÑO * escalaDaño(s));
    if (c.aguantando) {
      const reduccion = 0.5 + s.jugador.atributos.nervio * 0.02;
      daño = Math.max(1, Math.round(daño * (1 - Math.min(0.85, reduccion))));
      s = { ...s, log: log(s.log, `Aguantás. Sólo entran ${daño}.`, "malo") };
    } else {
      s = { ...s, log: log(s.log, `Te alcanza. ${daño}.`, "malo") };
    }
    s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - daño } };
  } else if (intencion.tipo === "efecto" && intencion.efecto) {
    const ef = intencion.efecto;
    const ya = s.efectos.some((x) => x.efecto === ef);
    s = {
      ...s,
      efectos: ya
        ? s.efectos.map((x) =>
            x.efecto === ef ? { ...x, turnos: duracionEfecto(s) } : x,
          )
        : [...s.efectos, { efecto: ef, turnos: duracionEfecto(s) }],
      log: log(s.log, NOMBRE_EFECTO[ef], "enemigo"),
    };
  }

  return {
    ...s,
    combate: { ...c, paso: c.paso + 1, aguantando: false },
  };
}

const NOMBRE_EFECTO: Record<Efecto, string> = {
  confusion: "Dejás de entender lo que estás mirando.",
  miedo: "Se te va la mano al costado. No responde.",
  torpeza: "El cuerpo te llega tarde.",
};

function tickEfectos(state: State): State {
  return {
    ...state,
    efectos: state.efectos
      .map((e) => ({ ...e, turnos: e.turnos - 1 }))
      .filter((e) => e.turnos > 0),
  };
}

function ganarCombate(state: State, rng: Rng): State {
  const c = state.combate!;
  const enemigo = ENEMIGOS[c.enemigoId];
  const materia = MATERIAS[c.materiaId];

  let jugador: Jugador = {
    ...state.jugador,
    xp: state.jugador.xp + enemigo.xp,
    sombras: [...state.jugador.sombras, enemigo.id],
  };

  let l = log(state.log, `${enemigo.nombre} deja de estar.`, "bueno");
  l = log(l, `Te queda su sombra. +${enemigo.xp} XP.`, "bueno");

  // Botín: a veces el arma de la materia, a veces un consumible.
  if (random(rng) < 0.35) {
    const armaId = pick(rng, materia.armas);
    if (jugador.armaId !== armaId) {
      jugador = { ...jugador, armaId };
      l = log(l, `Agarrás ${ARMAS[armaId].nombre}.`, "bueno");
    }
  } else if (random(rng) < 0.5 && jugador.items.length < 4) {
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
    log: l,
  };
}

// --- estado inicial -------------------------------------------------------

export function initialState(seed: number = randomSeed()): State {
  const rng = makeRng(seed);
  const jugador: Jugador = {
    nivel: 1,
    xp: 0,
    xpSiguiente: 25,
    vida: VIDA_BASE + 6,
    vidaMax: VIDA_BASE + 6,
    atributos: {
      conocimiento: ATRIBUTO_BASE,
      nervio: ATRIBUTO_BASE,
      reflejos: ATRIBUTO_BASE,
    },
    armaId: null,
    items: ["agua"],
    sombras: [],
    poderes: [],
    defectos: [],
  };
  const base: State = {
    seed,
    ciclo: 1,
    aulasHechas: 0,
    fase: "eligiendo-aula",
    jugador,
    aulas: [],
    combate: null,
    efectos: [],
    deformacion: Object.fromEntries(MATERIA_IDS.map((m) => [m, 0])),
    alias: {},
    oferta: [],
    log: [{ texto: "Sonó el timbre. No te acordás de haber entrado.", tipo: "neutral" }],
    final: null,
  };
  return { ...base, aulas: generarAulas(base, rng), seed: rng.seed };
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
    case "elegir-aula": {
      if (state.fase !== "eligiendo-aula") return state;
      const aula = state.aulas.find((a) => a.id === action.aulaId);
      if (!aula) return state;
      const enemigo = ENEMIGOS[aula.sorteado];
      const vidaMax = vidaMaxima(state);
      const vidaEnemigo = Math.round(enemigo.vida * escala(state));

      return {
        ...state,
        fase: "combate",
        // La vida vuelve al máximo al entrar: cada combate es autocontenido.
        jugador: { ...state.jugador, vida: vidaMax, vidaMax },
        efectos: [],
        combate: {
          enemigoId: enemigo.id,
          materiaId: aula.materiaId,
          vida: vidaEnemigo,
          vidaMax: vidaEnemigo,
          paso: 0,
          aguantando: false,
          debilidadVista: false,
        },
        log: log(
          state.log,
          `${nombreDe(state, aula.materiaId)}. Hay ${enemigo.nombre}.`,
        ),
      };
    }

    case "combate":
      return turnoDeCombate(state, action.accion, action.ref, rng);

    case "seguir": {
      if (state.fase === "recompensa") {
        const j = state.jugador;
        if (j.xp >= j.xpSiguiente) return { ...state, fase: "subir-nivel" };
        return avanzar(state, rng);
      }
      return state;
    }

    case "subir": {
      if (state.fase !== "subir-nivel") return state;
      const j = state.jugador;
      const jugador: Jugador = {
        ...j,
        nivel: j.nivel + 1,
        xp: j.xp - j.xpSiguiente,
        xpSiguiente: Math.round(j.xpSiguiente * 1.6),
        atributos: {
          ...j.atributos,
          [action.atributo]: j.atributos[action.atributo] + 2,
        },
      };
      const subido: State = {
        ...state,
        jugador,
        log: log(state.log, `Nivel ${jugador.nivel}. Subís ${action.atributo}.`, "bueno"),
      };
      return avanzar(subido, rng);
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
          `Y con eso viene ${defecto.nombre}. ${defecto.texto}`,
          "malo",
        ),
      };
      return despertar(aceptado, rng);
    }

    default:
      return state;
  }
}

/** Terminado un aula: siguiente aula, o a dormir si se acabó el ciclo. */
function avanzar(state: State, rng: Rng): State {
  const aulasHechas = state.aulasHechas + 1;
  if (aulasHechas >= AULAS_POR_CICLO) {
    return entrarAlSueño({ ...state, aulasHechas }, rng);
  }
  const base: State = { ...state, aulasHechas, fase: "eligiendo-aula" };
  return { ...base, aulas: generarAulas(base, rng) };
}

function turnoDeCombate(
  state: State,
  accion: Accion,
  ref: string | undefined,
  rng: Rng,
): State {
  if (state.fase !== "combate" || !state.combate) return state;
  const c = state.combate;
  const enemigo = ENEMIGOS[c.enemigoId];
  let s = state;

  if (accion === "huir") {
    if (!puedeHuir(s)) return s;
    return avanzar(
      {
        ...s,
        combate: null,
        efectos: [],
        log: log(s.log, "Salís al pasillo. No mirás atrás.", "neutral"),
      },
      rng,
    );
  }

  // El miedo puede hacer que la acción no salga.
  if (tieneEfecto(s, "miedo")) {
    const falla = Math.max(0.08, 0.4 - s.jugador.atributos.nervio * 0.025);
    if (random(rng) < falla) {
      s = { ...s, log: log(s.log, "No te sale. Te quedás duro.", "malo") };
      return cerrarTurno(s, rng);
    }
  }

  let vidaEnemigo = c.vida;
  let aguantando = false;
  let debilidadVista = c.debilidadVista;

  switch (accion) {
    case "resolver":
    case "esquivar": {
      // Acertarle a la debilidad es la diferencia entre ganar y no ganar.
      // El verbo equivocado casi no lastima: encontrarla es el combate.
      const acierta = enemigo.debilidad === accion;
      let d = aplicarDaño(s, dañoDe(s, accion));
      d = Math.round(d * (acierta ? 2 : 0.5));
      if (acierta) debilidadVista = true;
      vidaEnemigo -= d;
      s = {
        ...s,
        log: log(
          s.log,
          acierta
            ? `${accion === "resolver" ? "Resolvés" : "Esquivás"} y era eso. ${d}.`
            : `${accion === "resolver" ? "Resolvés" : "Esquivás"}. ${d}.`,
          acierta ? "bueno" : "neutral",
        ),
      };
      break;
    }
    case "aguantar": {
      aguantando = true;
      const acierta = enemigo.debilidad === "aguantar";
      const cura = acierta
        ? 2 + Math.round(s.jugador.atributos.nervio * 0.4)
        : 2;
      if (acierta) debilidadVista = true;
      s = {
        ...s,
        jugador: {
          ...s.jugador,
          vida: Math.min(s.jugador.vidaMax, s.jugador.vida + cura),
        },
        log: log(s.log, `Te plantás. Recuperás ${cura}.`, "neutral"),
      };
      if (acierta) {
        const d = aplicarDaño(s, 6 + s.jugador.atributos.nervio);
        vidaEnemigo -= d;
        s = { ...s, log: log(s.log, `Se cansa contra vos. ${d}.`, "bueno") };
      }
      break;
    }
    case "arma": {
      if (!s.jugador.armaId) return s;
      const arma = ARMAS[s.jugador.armaId];
      const d = aplicarDaño(s, dañoDe(s, "arma"));
      vidaEnemigo -= d;
      s = { ...s, log: log(s.log, `${arma.texto} ${d}.`, "neutral") };
      break;
    }
    case "item": {
      if (!ref) return s;
      // Las sombras se gastan en sacarte lo que tengas encima.
      if (ref.startsWith("sombra:")) {
        const id = ref.slice(7);
        if (!s.jugador.sombras.includes(id)) return s;
        const i = s.jugador.sombras.indexOf(id);
        s = {
          ...s,
          jugador: {
            ...s.jugador,
            sombras: s.jugador.sombras.filter((_, k) => k !== i),
          },
          efectos: [],
          log: log(s.log, `La sombra de ${ENEMIGOS[id].nombre} se interpone.`, "bueno"),
        };
        break;
      }
      const idx = s.jugador.items.indexOf(ref);
      if (idx === -1) return s;
      const item = ITEMS[ref];
      let j = { ...s.jugador, items: s.jugador.items.filter((_, k) => k !== idx) };
      if (item.efecto.vida) {
        j = { ...j, vida: Math.min(j.vidaMax, j.vida + item.efecto.vida) };
      }
      if (item.efecto.daño) vidaEnemigo -= aplicarDaño(s, item.efecto.daño);
      s = {
        ...s,
        jugador: j,
        efectos: item.efecto.limpia ? [] : s.efectos,
        log: log(s.log, `Usás ${item.nombre}.`, "neutral"),
      };
      break;
    }
    case "poder": {
      if (!ref) return s;
      const tiene = s.jugador.poderes.find((p) => p.id === ref);
      if (!tiene || tiene.usos <= 0) return s;
      const poder = PODERES[ref];
      let j = {
        ...s.jugador,
        poderes: s.jugador.poderes.map((p) =>
          p.id === ref ? { ...p, usos: p.usos - 1 } : p,
        ),
      };
      if (poder.efecto.daño) vidaEnemigo -= aplicarDaño(s, poder.efecto.daño);
      if (poder.efecto.vida) {
        j = { ...j, vida: Math.min(j.vidaMax, j.vida + poder.efecto.vida) };
      }
      s = {
        ...s,
        jugador: j,
        efectos: poder.efecto.limpia ? [] : s.efectos,
        log: log(s.log, `${poder.nombre}.`, "sueño"),
      };
      break;
    }
  }

  s = {
    ...s,
    combate: { ...s.combate!, vida: vidaEnemigo, aguantando, debilidadVista },
  };

  if (vidaEnemigo <= 0) return ganarCombate(s, rng);
  return cerrarTurno(s, rng);
}

/** Turno del enemigo, efectos, y chequeo de muerte. */
function cerrarTurno(state: State, rng: Rng): State {
  let s = turnoEnemigo(state, rng);
  // La torpeza le da un segundo turno.
  if (tieneEfecto(s, "torpeza") && s.jugador.vida > 0) {
    s = { ...s, log: log(s.log, "Todavía no terminaste de moverte.", "enemigo") };
    s = turnoEnemigo(s, rng);
  }
  s = tickEfectos(s);

  if (s.jugador.vida <= 0) {
    return {
      ...s,
      jugador: { ...s.jugador, vida: 0 },
      fase: "muerto",
      combate: null,
      final: "No sonó ningún timbre.",
    };
  }
  return s;
}
