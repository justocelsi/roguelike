/**
 * El motor. Un reducer puro: (State, Action) => State.
 *
 * No importa React ni toca el DOM. Todo el azar pasa por el RNG sembrado que
 * se guarda en el propio estado, así que una run entera es reproducible desde
 * su semilla.
 *
 * Las distorsiones no están cableadas acá: el motor las consulta como
 * interceptores en cada punto donde toma una decisión.
 */

import { EVENTS, generateRooms } from "./content";
import { CHICAS, GRANDES, getDistortion } from "./distortions";
import { makeRng, pick, pickMany, randomSeed, type Rng } from "./rng";
import type {
  Action,
  Distortion,
  LogEntry,
  Room,
  State,
  Verb,
} from "./types";

export const VIGILIA_MAX = 20;
export const CICLOS = 5;
export const SALAS_POR_ELECCION = 3;

const COSTO_BASE: Record<Verb, number> = {
  observar: 2,
  actuar: 1,
  retirarse: 0,
};
const COSTO_ENTRAR = 1;
const ACCIONES_ANTES_DE_MADURAR = 2;

// --- lectura del estado ---------------------------------------------------

export function activeDistortions(state: State): Distortion[] {
  const out = state.chicas.map(getDistortion);
  if (state.grande) out.push(getDistortion(state.grande));
  return out;
}

/** Los interceptores agregados, listos para consultar. */
export function flags(state: State) {
  const ds = activeDistortions(state);
  return {
    hideReadings: ds.some((d) => d.hideReadings),
    revealBeforeEntering: ds.some((d) => d.revealBeforeEntering),
    noVoluntarySleep: ds.some((d) => d.noVoluntarySleep),
    freeEntry: ds.some((d) => d.freeEntry),
    maxActions: Math.min(...ds.map((d) => d.maxActions ?? Infinity)),
    withdrawRefund: ds.reduce((a, d) => a + (d.withdrawRefund ?? 0), 0),
    maturationBonus: ds.reduce((a, d) => a + (d.maturationBonus ?? 0), 0),
  };
}

export function verbCost(state: State, verb: Verb): number {
  let cost = COSTO_BASE[verb];
  for (const d of activeDistortions(state)) {
    if (d.verbCost) cost = d.verbCost(verb, cost);
  }
  return Math.max(0, cost);
}

/** Si Observar todavía está disponible en esta sala. */
export function canObserve(state: State): boolean {
  if (state.observed) return false;
  return state.actionsInRoom < flags(state).maxActions;
}

/**
 * Degradación de la interfaz. Cuanto menos Vigilia, menos preciso el número.
 * El cansancio no pega más fuerte: hace saber menos.
 */
export function formatProbability(p: number, state: State): string {
  const pct = Math.round(p * 100);
  const ratio = state.vigilia / state.vigiliaMax;
  if (ratio > 0.7) return `${pct}%`;
  if (ratio > 0.4) return `~${pct}%`;
  if (ratio > 0.15) return `${Math.floor(pct / 10)}?%`;
  return "??";
}

// --- helpers internos -----------------------------------------------------

function addLog(
  log: LogEntry[],
  text: string,
  kind: LogEntry["kind"] = "neutral",
): LogEntry[] {
  return [{ text, kind }, ...log].slice(0, 40);
}

function freshRooms(state: State, rng: Rng): Room[] {
  let rooms = generateRooms(rng, SALAS_POR_ELECCION);
  for (const d of activeDistortions(state)) {
    if (d.distortReadings) {
      const fn = d.distortReadings;
      rooms = rooms.map((r) => ({ ...r, readings: fn(r.readings, rng) }));
    }
  }
  return rooms;
}

/** Distorsiones que todavía se pueden ofrecer. */
function candidates(state: State): Distortion[] {
  const chicas = CHICAS.filter((d) => !state.chicas.includes(d.id));
  const grandes = GRANDES.filter((d) => d.id !== state.grande);
  return [...chicas, ...grandes];
}

function sleepNow(state: State, rng: Rng, forced: boolean): State {
  // En el último ciclo no se ofrece nada: elegir una distorsión que no vas a
  // llegar a jugar no es una decisión.
  if (state.cycle >= CICLOS) return wake(state, rng);

  const pool = candidates(state);
  if (pool.length === 0) return wake(state, rng);

  // Desplomarte no te deja elegir: la pesadilla elige, y prefiere las grandes.
  let offered: string[];
  if (forced) {
    const grandes = pool.filter((d) => d.tier === "grande");
    offered = [pick(rng, grandes.length > 0 ? grandes : pool).id];
  } else {
    offered = pickMany(rng, pool, 3).map((d) => d.id);
  }

  return {
    ...state,
    phase: "durmiendo",
    forced,
    offered,
    currentRoom: null,
    currentEvent: null,
    vigilia: Math.max(0, state.vigilia),
    log: addLog(
      state.log,
      forced
        ? "Te desplomás. No elegís nada: el sueño elige por vos."
        : "Cerrás los ojos a propósito.",
      "sueño",
    ),
  };
}

/** Termina el sueño y arranca el ciclo siguiente. */
function wake(state: State, rng: Rng): State {
  const cycle = state.cycle + 1;
  if (cycle > CICLOS) {
    return {
      ...state,
      phase: "fin",
      ending:
        "Aguantaste todos los ciclos. El lugar quedó irreconocible, y lo hiciste vos.",
      log: addLog(state.log, "Despertás. Ya no hay dónde volver.", "sueño"),
    };
  }
  const woken: State = {
    ...state,
    cycle,
    phase: "eligiendo-sala",
    vigilia: state.vigiliaMax,
    offered: [],
    forced: false,
    observed: false,
    actionsInRoom: 0,
  };
  return { ...woken, rooms: freshRooms(woken, rng) };
}

/** Se llama después de cada cambio de Vigilia. */
function checkCollapse(state: State, rng: Rng): State {
  if (state.vigilia > 0) return state;

  const ev = state.currentEvent ? EVENTS[state.currentEvent] : null;
  // Desplomarte es seguro sólo si estás solo.
  if (ev?.hostile) {
    return {
      ...state,
      vigilia: 0,
      phase: "muerto",
      ending:
        "Te desplomaste delante de algo que estaba esperando exactamente eso.",
      log: addLog(state.log, "Se te cierran los ojos. Todavía respira.", "malo"),
    };
  }
  return sleepNow(state, rng, true);
}

function leaveRoom(state: State, rng: Rng): State {
  const left: State = {
    ...state,
    phase: "eligiendo-sala",
    currentRoom: null,
    currentEvent: null,
    observed: false,
    actionsInRoom: 0,
  };
  return { ...left, rooms: freshRooms(left, rng) };
}

/** El evento se vuelve otra cosa si te quedás demasiado. */
function maybeMature(state: State, rng: Rng): State {
  const limite = ACCIONES_ANTES_DE_MADURAR + flags(state).maturationBonus;
  if (state.actionsInRoom < limite) return state;

  const ev = state.currentEvent ? EVENTS[state.currentEvent] : null;
  if (!ev?.maturesTo) return state;

  const next = EVENTS[ev.maturesTo];
  return {
    ...state,
    currentEvent: next.id,
    // Lo que sabías era sobre otra cosa.
    observed: false,
    log: addLog(
      state.log,
      `Tardaste. Ya no es ${ev.label}: ahora es ${next.label}.`,
      "malo",
    ),
  };
}

// --- estado inicial -------------------------------------------------------

export function initialState(seed: number = randomSeed()): State {
  const rng = makeRng(seed);
  const base: State = {
    seed,
    cycle: 1,
    vigilia: VIGILIA_MAX,
    vigiliaMax: VIGILIA_MAX,
    phase: "eligiendo-sala",
    rooms: [],
    currentRoom: null,
    currentEvent: null,
    observed: false,
    actionsInRoom: 0,
    chicas: [],
    grande: null,
    offered: [],
    forced: false,
    log: [{ text: "Estás despierto. No sabés desde cuándo.", kind: "neutral" }],
    ending: null,
  };
  return { ...base, rooms: freshRooms(base, rng), seed: rng.seed };
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
    case "elegir-sala": {
      if (state.phase !== "eligiendo-sala") return state;
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;

      const costo = flags(state).freeEntry ? 0 : COSTO_ENTRAR;
      const entered: State = {
        ...state,
        phase: "en-sala",
        currentRoom: room,
        currentEvent: room.rolled,
        observed: false,
        actionsInRoom: 0,
        vigilia: state.vigilia - costo,
        log: addLog(state.log, `Entrás. ${room.name}.`),
      };
      return checkCollapse(entered, rng);
    }

    case "verbo": {
      if (state.phase !== "en-sala" || !state.currentEvent) return state;
      const ev = EVENTS[state.currentEvent];

      if (action.verb === "observar") {
        if (!canObserve(state)) return state;
        const observed: State = {
          ...state,
          observed: true,
          actionsInRoom: state.actionsInRoom + 1,
          vigilia: state.vigilia - verbCost(state, "observar"),
          log: addLog(state.log, ev.reveal, "neutral"),
        };
        return checkCollapse(maybeMature(observed, rng), rng);
      }

      if (action.verb === "retirarse") {
        const refund = flags(state).withdrawRefund;
        const out: State = {
          ...state,
          vigilia: Math.min(state.vigiliaMax, state.vigilia + refund),
          log: addLog(state.log, "Salís sin tocar nada."),
        };
        return leaveRoom(out, rng);
      }

      // actuar
      const outcome = state.observed ? ev.informed : ev.blind;
      const bonus = activeDistortions(state).reduce(
        (a, d) => a + (d.outcomeBonus?.(state.observed) ?? 0),
        0,
      );
      const delta = outcome.vigilia + (outcome.vigilia > 0 ? bonus : 0);
      const acted: State = {
        ...state,
        vigilia: Math.min(state.vigiliaMax, state.vigilia + delta),
        log: addLog(
          state.log,
          outcome.text,
          delta >= 0 ? "bueno" : "malo",
        ),
      };
      // Si la resolución te dejó en cero, primero se resuelve eso.
      const settled = checkCollapse(acted, rng);
      if (settled.phase !== "en-sala") return settled;
      return leaveRoom(settled, rng);
    }

    case "dormir": {
      if (state.phase !== "eligiendo-sala") return state;
      if (flags(state).noVoluntarySleep) return state;
      return sleepNow(state, rng, false);
    }

    case "elegir-distorsion": {
      if (state.phase !== "durmiendo") return state;
      if (!state.offered.includes(action.id)) return state;
      const d = getDistortion(action.id);

      const applied: State =
        d.tier === "chica"
          ? { ...state, chicas: [...state.chicas, d.id] }
          : { ...state, grande: d.id };

      return wake(
        {
          ...applied,
          log: addLog(applied.log, `${d.name}. ${d.text}`, "sueño"),
        },
        rng,
      );
    }

    default:
      return state;
  }
}
