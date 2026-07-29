/** Tipos del motor. Sin React, sin DOM: esto corre en cualquier lado. */

import type { Mundo } from "./mundo";

export type Efecto = "confusion" | "miedo" | "torpeza";

/**
 * Cinco acciones y ninguna estadística detrás. Toda acción consume un turno.
 * La decisión no es "cuál pega más" sino "qué corresponde ahora".
 */
export type Accion = "atacar" | "esperar" | "arma" | "usar" | "huir";

// --- contenido ------------------------------------------------------------

export type Materia = {
  id: string;
  nombre: string;
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
  patron: Intencion[];
  /** Los profesores cierran el ciclo y no se pueden esquivar. */
  profesor?: boolean;
};

export type Arma = {
  id: string;
  nombre: string;
  daño: number;
  /** Se gasta. Es la razón por la que no la usás siempre. */
  usos: number;
  texto: string;
};

export type Item = {
  id: string;
  nombre: string;
  descripcion: string;
  efecto: { vida?: number; limpia?: boolean; daño?: number };
};

export type Poder = {
  id: string;
  nombre: string;
  texto: string;
  usos: number;
  efecto: { daño?: number; vida?: number; limpia?: boolean };
};

export type Defecto = {
  id: string;
  nombre: string;
  texto: string;
  // --- interceptores sobre el motor ---
  daño?: (base: number) => number;
  recibido?: (base: number) => number;
  vidaMax?: (base: number) => number;
  sinHuida?: boolean;
  menosPuertas?: boolean;
  efectosLargos?: boolean;
};

// --- estado ---------------------------------------------------------------

export type EfectoActivo = { efecto: Efecto; turnos: number };

export type Combate = {
  enemigoId: string;
  materiaId: string;
  vida: number;
  vidaMax: number;
  paso: number;
  esperando: boolean;
};

export type Fase = "pasillo" | "combate" | "recompensa" | "sueño" | "muerto" | "fin";

export type Jugador = {
  vida: number;
  vidaMax: number;
  armaId: string | null;
  armaUsos: number;
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
  fase: Fase;
  jugador: Jugador;

  /** El pasillo que estás caminando. */
  mundo: Mundo | null;
  combate: Combate | null;
  efectos: EfectoActivo[];

  /** Nivel de deformación por materia: 0 limpia, 3 irreconocible. */
  deformacion: Record<string, number>;
  /** Se venció al profesor: al salir de la recompensa se duerme. */
  cicloTerminado: boolean;

  oferta: { poderId: string; defectoId: string }[];

  log: Entrada[];
  final: string | null;
};

export type Action =
  | { type: "entrar-aula"; puertaX: number; puertaY: number }
  | { type: "combate"; accion: Accion; ref?: string }
  | { type: "seguir" }
  | { type: "aceptar-oferta"; index: number }
  | { type: "reiniciar"; seed?: number };
