/** Tipos del motor. Sin React, sin DOM: esto corre en cualquier lado. */

import type { Mundo } from "./mundo";

export type Efecto = "confusion" | "miedo" | "torpeza";

/**
 * Cinco acciones y ninguna estadística detrás. Toda acción consume un turno.
 * La decisión no es "cuál pega más" sino "qué corresponde ahora".
 */
export type Accion = "atacar" | "bloquear" | "arma" | "usar" | "huir";

// --- contenido ------------------------------------------------------------

export type Materia = {
  id: string;
  nombre: string;
  efecto: Efecto;
  enemigos: string[];
  /**
   * Cada materia da siempre lo mismo. No es una limitación: es lo que hace
   * que en la run número diez sepas que Biología cura y Química lastima, y
   * elijas el pasillo con esa información.
   */
  armas: string[];
  items: string[];
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
  /** Usos por combate. Se recuperan en el próximo. */
  usos: number;
  /** Las que no se gastan: menos daño, pero están siempre. */
  infinita?: boolean;
  /**
   * Chance de perderla para siempre al acertar un golpe. Sólo se tira si el
   * golpe entró: si erraste, no hubo rebote que perder.
   */
  perdida?: number;
  /** 0..1 con el arma entera. Cuanto más pega, menos acierta. */
  precision: number;
  /** Cuánta precisión pierde por cada uso, dentro de la pelea. */
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
  /**
   * Los pasivos no se usan: te cambian una regla mientras los tengas. No
   * aparecen en el menú de acciones, viven en la ficha de arriba.
   */
  pasivo?: { contraDaño?: number; contraPrecision?: number };
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
  bloqueando: boolean;
  /**
   * Lo que se recarga en cada pelea: los usos de cada arma y de cada poder.
   * Los items y las sombras no están acá porque esos sí se gastan de verdad,
   * y decidir si los quemás ahora o los guardás es parte del juego.
   */
  armasUsadas: Record<string, number>;
  poderesUsados: Record<string, number>;
};

export type Fase = "pasillo" | "combate" | "recompensa" | "sueño" | "muerto" | "fin";

export type Jugador = {
  /** Lo único que se restaura solo en cada aula. */
  vida: number;
  vidaMax: number;
  /** Hasta MAX_ARMAS. Cada una con sus usos por pelea. */
  armas: string[];
  /** Se consumen de verdad: guardarlos o quemarlos es una decisión. */
  items: string[];
  sombras: string[];
  /** Capacidad permanente; los usos se recargan cada combate. */
  poderes: string[];
  defectos: string[];
};

export type Entrada = {
  texto: string;
  tipo: "neutral" | "bueno" | "malo" | "sueño" | "enemigo";
  /**
   * Cómo quedaban las vidas justo después de este evento. La interfaz las usa
   * para que las barras bajen en el mismo momento en que se lee el golpe, y
   * no antes.
   */
  vidaJugador?: number;
  vidaEnemigo?: number;
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
  /** El que acaba de caer. La recompensa lo muestra desarmándose. */
  caido: { enemigoId: string; materiaId: string } | null;
  /**
   * Profesores vencidos. Cada uno te sube el daño de todo lo que hacés: sin
   * eso, los enemigos escalan por ciclo y tus números se quedan atrás.
   */
  profesoresVencidos: number;

  oferta: { poderId: string; defectoId: string }[];
  /** Un arma encontrada con la mochila llena: hay que elegir qué dejar. */
  armaOfrecida: string | null;
  /** Lo que sacaste del aula, listado uno por uno con su cantidad. */
  botin: {
    tipo: "item" | "arma" | "sombra" | "vida" | "potencia";
    id: string;
    cantidad: number;
  }[];

  log: Entrada[];
  final: string | null;
};

export type Action =
  | { type: "entrar-aula"; puertaX: number; puertaY: number }
  | { type: "combate"; accion: Accion; ref?: string }
  | { type: "seguir" }
  | { type: "aceptar-oferta"; index: number }
  /** `dejar` null = descartar la que encontraste. */
  | { type: "canjear-arma"; dejar: string | null }
  | { type: "reiniciar"; seed?: number };
