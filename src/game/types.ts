/** Tipos del motor. Sin React, sin DOM: esto corre en cualquier lado. */

export type Atributo = "conocimiento" | "nervio" | "reflejos";
export type Efecto = "confusion" | "miedo" | "torpeza";

/** Las acciones de combate. Toda acción consume un turno. */
export type Accion =
  | "resolver"
  | "aguantar"
  | "esquivar"
  | "arma"
  | "item"
  | "poder"
  | "huir";

// --- contenido ------------------------------------------------------------

export type Materia = {
  id: string;
  nombre: string;
  /** Qué atributo lastima esta materia. */
  atributo: Atributo;
  efecto: Efecto;
  enemigos: string[];
  armas: string[];
};

/** Lo que el enemigo va a hacer el turno que viene. Se telegrafía siempre. */
export type Intencion = {
  tell: string;
  tipo: "golpe" | "efecto" | "espera";
  daño?: number;
  efecto?: Efecto;
};

export type Enemigo = {
  id: string;
  nombre: string;
  vida: number;
  /** El verbo que le funciona mejor. Descubrirlo es el juego. */
  debilidad: Extract<Accion, "resolver" | "aguantar" | "esquivar">;
  /** Patrón cíclico de intenciones. */
  patron: Intencion[];
  xp: number;
};

export type Arma = {
  id: string;
  nombre: string;
  daño: number;
  /** Texto al usarla. */
  texto: string;
};

export type Item = {
  id: string;
  nombre: string;
  descripcion: string;
  efecto: { vida?: number; limpia?: boolean; daño?: number };
};

/** Poder y defecto se sortean por separado: 6 × 6 = 36 ofertas. */
export type Poder = {
  id: string;
  nombre: string;
  texto: string;
  usos: number;
  /** Daño directo, curación, o limpieza de efectos. */
  efecto: { daño?: number; vida?: number; limpia?: boolean; anula?: boolean };
};

export type Defecto = {
  id: string;
  nombre: string;
  texto: string;
  // --- interceptores sobre el motor ---
  /** Modifica el daño que hacés. */
  daño?: (base: number) => number;
  /** Modifica el daño que recibís. */
  recibido?: (base: number) => number;
  /** Vida máxima. */
  vidaMax?: (base: number) => number;
  /** No se puede huir. */
  sinHuida?: boolean;
  /** Aulas ofrecidas por vez. */
  menosAulas?: boolean;
  /** Los efectos duran un turno más. */
  efectosLargos?: boolean;
};

// --- estado ---------------------------------------------------------------

export type EfectoActivo = { efecto: Efecto; turnos: number };

export type Combate = {
  enemigoId: string;
  materiaId: string;
  vida: number;
  vidaMax: number;
  /** Índice dentro del patrón del enemigo. */
  paso: number;
  /** Si el jugador está aguantando este turno. */
  aguantando: boolean;
  /** Debilidad ya descubierta por el jugador. */
  debilidadVista: boolean;
};

export type Aula = {
  id: string;
  materiaId: string;
  /** Enemigos posibles con su probabilidad declarada. */
  lecturas: { enemigoId: string; prob: number }[];
  /** El que realmente está. */
  sorteado: string;
};

export type Fase =
  | "eligiendo-aula"
  | "combate"
  | "recompensa"
  | "subir-nivel"
  | "sueño"
  | "muerto"
  | "fin";

export type Jugador = {
  nivel: number;
  xp: number;
  xpSiguiente: number;
  vida: number;
  vidaMax: number;
  atributos: Record<Atributo, number>;
  armaId: string | null;
  items: string[];
  sombras: string[];
  poderes: { id: string; usos: number }[];
  defectos: string[];
};

export type Entrada = {
  texto: string;
  tipo: "neutral" | "bueno" | "malo" | "sueño" | "enemigo";
};

export type State = {
  seed: number;
  ciclo: number;
  /** Aulas completadas en este ciclo. */
  aulasHechas: number;
  fase: Fase;
  jugador: Jugador;

  aulas: Aula[];
  combate: Combate | null;
  efectos: EfectoActivo[];

  /** Nivel de deformación por materia: 0 limpia, 3 irreconocible. */
  deformacion: Record<string, number>;
  /** Nombres deformados ya asignados. */
  alias: Record<string, string>;

  /** Oferta del sueño. */
  oferta: { poderId: string; defectoId: string }[];

  log: Entrada[];
  final: string | null;
};

export type Action =
  | { type: "elegir-aula"; aulaId: string }
  | { type: "combate"; accion: Accion; ref?: string }
  | { type: "seguir" }
  | { type: "subir"; atributo: Atributo }
  | { type: "aceptar-oferta"; index: number }
  | { type: "reiniciar"; seed?: number };
