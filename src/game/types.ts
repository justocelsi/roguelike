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
  /** El aviso, un turno antes. Es lo que el jugador tiene que leer. */
  tell: string;
  tipo: "golpe" | "efecto" | "espera";
  /** Qué se siente cuando efectivamente pasa. Distinto del aviso. */
  impacto?: string;
  daño?: number;
  efecto?: Efecto;
  /** 0..1. Nada acierta siempre, tampoco de este lado. */
  precision?: number;
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
  /** 0..1 con el arma entera. Cuanto más pega, menos acierta. */
  precision: number;
  /** Cuánta precisión pierde por cada uso. El filo se va. */
  desgaste: number;
  /** Probabilidad de pegar el doble. */
  critico: number;
  texto: string;
};

export type Item = {
  id: string;
  nombre: string;
  descripcion: string;
  precision: number;
  efecto: { vida?: number; limpia?: boolean; daño?: number };
};

export type Poder = {
  id: string;
  nombre: string;
  texto: string;
  usos: number;
  precision: number;
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
  /**
   * Todo lo que gastaste vive acá adentro y muere con el combate. El
   * inventario del jugador nunca se toca: lo que tenés es una capacidad, lo
   * gastado es una condición, y las condiciones no cruzan la puerta.
   */
  itemsUsados: string[];
  poderesUsados: Record<string, number>;
  armaUsada: number;
  /** Una sola por combate, por más cadáveres que lleves encima. */
  sombrasUsadas: number;
};

export type Fase = "pasillo" | "combate" | "recompensa" | "sueño" | "muerto" | "fin";

/**
 * Sólo capacidades. Nada de acá se consume peleando: los usos se recuperan
 * en cada combate. Lo único que cambia entre aulas es qué tenés, no cuánto
 * te queda.
 */
export type Jugador = {
  vida: number;
  vidaMax: number;
  armaId: string | null;
  /** Uno por cada ejemplar. Repetidos = más usos por combate. */
  items: string[];
  sombras: string[];
  poderes: string[];
  defectos: string[];
};

export type Entrada = {
  texto: string;
  tipo: "neutral" | "bueno" | "malo" | "sueño" | "enemigo";
  /**
   * Quién lo hizo. La interfaz mete una pausa larga cuando el turno cambia de
   * manos, para que se lea como una secuencia y no como un bloque.
   */
  actor?: "vos" | "eso";
  /** Si el evento tiene un símbolo propio, cuál. */
  icono?: Efecto;
  /**
   * Es el enemigo mostrando qué va a hacer el turno que viene. Se queda más
   * tiempo en pantalla que el resto: es lo único que el jugador necesita leer
   * para decidir.
   */
  aviso?: boolean;
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
