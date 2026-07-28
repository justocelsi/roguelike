/** Tipos del motor. Sin React, sin DOM: esto corre en cualquier lado. */

import type { Rng } from "./rng";

/** Los tres verbos. Son los mismos dentro y fuera de combate. */
export type Verb = "observar" | "actuar" | "retirarse";

/** Un evento posible dentro de una sala. */
export type GameEvent = {
  id: string;
  /** Lo que se declara desde afuera, antes de entrar. Vago a propósito. */
  label: string;
  /** Lo que Observar revela. Acá se dice la verdad. */
  reveal: string;
  /** Cómo se llama Actuar para este evento: Tomar, Forzar, Registrar... */
  actVerb: string;
  /** Resultado de Actuar sin haber observado. */
  blind: Outcome;
  /** Resultado de Actuar habiendo observado. */
  informed: Outcome;
  /** En qué se convierte si te quedás demasiado. */
  maturesTo?: string;
  hostile?: boolean;
};

export type Outcome = {
  /** Delta de Vigilia. Positivo repone, negativo cuesta. */
  vigilia: number;
  text: string;
};

/** Una lectura declarada de la sala: un evento posible y su probabilidad. */
export type Reading = {
  eventId: string;
  /** Probabilidad declarada, 0..1. Puede no ser la real. */
  declared: number;
  /** La real. El jugador nunca la ve. */
  actual: number;
};

export type Room = {
  id: string;
  name: string;
  readings: Reading[];
  /**
   * El evento que realmente va a ocurrir. Se sortea al generar la sala, no al
   * entrar, para que "Lucidez" pueda mostrarlo antes de que el jugador elija.
   */
  rolled: string;
};

/** Distorsión. Los campos opcionales son interceptores sobre el motor. */
export type Distortion = {
  id: string;
  name: string;
  tier: "chica" | "grande";
  /** Texto que se muestra en la pantalla del sueño. */
  text: string;

  // --- interceptores ---
  /** Modifica el costo en Vigilia de un verbo. */
  verbCost?: (verb: Verb, base: number) => number;
  /** Deforma las probabilidades declaradas antes de mostrarlas. */
  distortReadings?: (readings: Reading[], rng: Rng) => Reading[];
  /** Oculta del todo las lecturas: sólo se ve el nombre de la sala. */
  hideReadings?: boolean;
  /** Revela el evento real antes de entrar. */
  revealBeforeEntering?: boolean;
  /** Techo de acciones por sala. */
  maxActions?: number;
  /** Cuántas acciones de más aguanta el evento antes de madurar. */
  maturationBonus?: number;
  /** Vigilia que devuelve retirarse. */
  withdrawRefund?: number;
  /** Vigilia extra al resolver un evento. */
  outcomeBonus?: (informed: boolean) => number;
  /** Entrar a una sala no cuesta Vigilia. */
  freeEntry?: boolean;
  /** No se puede dormir por voluntad propia. */
  noVoluntarySleep?: boolean;
};

export type Phase =
  | "eligiendo-sala"
  | "en-sala"
  | "durmiendo"
  | "muerto"
  | "fin";

export type State = {
  seed: number;
  /** Ciclo actual, 1-indexado. */
  cycle: number;
  vigilia: number;
  vigiliaMax: number;
  phase: Phase;

  /** Salas ofrecidas en este momento. */
  rooms: Room[];
  /** Sala en la que estamos, si phase === "en-sala". */
  currentRoom: Room | null;
  /** Evento sorteado para la sala actual. */
  currentEvent: string | null;
  /** Si ya lo observamos. */
  observed: boolean;
  /** Acciones gastadas en la sala actual (para la maduración). */
  actionsInRoom: number;

  /** Distorsiones chicas acumuladas. */
  chicas: string[];
  /** La grande activa. Sólo puede haber una. */
  grande: string | null;
  /** Las tres opciones ofrecidas mientras phase === "durmiendo". */
  offered: string[];
  /** Si la distorsión la elige la pesadilla (te desplomaste). */
  forced: boolean;

  /** Bitácora de la run, lo último primero. */
  log: LogEntry[];
  /** Cómo terminó, si terminó. */
  ending: string | null;
};

export type LogEntry = {
  text: string;
  kind: "neutral" | "bueno" | "malo" | "sueño";
};

export type Action =
  | { type: "elegir-sala"; roomId: string }
  | { type: "verbo"; verb: Verb }
  | { type: "dormir" }
  | { type: "elegir-distorsion"; id: string }
  | { type: "reiniciar"; seed?: number };
