/**
 * El pasillo: mapa de tiles y física de movimiento.
 *
 * Puro, sin canvas ni DOM. El renderer sólo lee de acá. Movimiento continuo
 * (no por casillas) con colisión AABB contra la grilla.
 */

import { pick, pickWeighted, randInt, type Rng } from "./rng";
import { MATERIAS, MATERIA_IDS, PROFESORES } from "./content";

export const TILE = 16;
/** Ancho del jugador en píxeles. Un poco menor que un tile para no trabarse. */
export const CUERPO = 10;
export const VELOCIDAD = 62; // px por segundo

export const PISO = 0;
export const PARED = 1;
export const PUERTA = 2;
/**
 * Interior de un aula. No se camina: se ve. Se dibuja difuminado detrás de la
 * pared para que el pasillo tenga profundidad y no sea un tubo.
 */
export const SALA = 3;

/** Lo que puede pasar al abrir una puerta. */
export type Suceso = "pelea" | "bendicion" | "juego";

/**
 * Las puertas vienen en formas reconocibles. La idea es la misma que las salas
 * icónicas: en la run número diez tenés que poder mirar una puerta y saber qué
 * clase de puerta es, sin leer los números uno por uno.
 *
 * **Todos los porcentajes son múltiplos de 10.** No es cosmético: un riesgo que
 * se puede pensar en décimos se calcula de cabeza mientras caminás el pasillo, y
 * uno que dice 37% obliga a leer el número entero para no entender nada mejor.
 *
 * La única excepción es *la incierta*, que reparte parejo entre las tres cosas.
 * Se lee igual de rápido —"acá puede pasar cualquiera"— y es el único lugar
 * donde no hay nada más probable que otra cosa.
 */
export const FORMAS_PUERTA = [
  { id: "normal", peso: 5, reparto: { pelea: 70, bendicion: 20, juego: 10 } },
  { id: "peligrosa", peso: 3, reparto: { pelea: 90, bendicion: 0, juego: 10 } },
  { id: "tranquila", peso: 2, reparto: { pelea: 50, bendicion: 40, juego: 10 } },
  { id: "rara", peso: 1, reparto: { pelea: 60, bendicion: 10, juego: 30 } },
  // El 34 va a la pelea porque es lo que el juego es; los tres se muestran
  // como un tercio cada uno, que es lo que el jugador necesita saber.
  { id: "incierta", peso: 1, reparto: { pelea: 34, bendicion: 33, juego: 33 } },
] as const;

export type Puerta = {
  x: number;
  y: number;
  materiaId: string;
  /** Qué clase de puerta es. Se aprende a reconocerla. */
  forma: string;
  /** Lo que puede pasar, con su probabilidad entera. Suman 100. */
  lecturas: { suceso: Suceso; enemigoId?: string; prob: number }[];
  /** Lo que realmente pasa. */
  sorteado: Suceso;
  /** Con qué enemigo, si toca pelea. */
  enemigoId: string;
  usada: boolean;
  /** El rectángulo del aula que se ve detrás, en tiles. */
  sala: { x0: number; y0: number; x1: number; y1: number };
  /**
   * La puerta del fondo. Siempre está abierta: podés ir derecho al profesor o
   * limpiar aulas antes para juntar armas. Esa es la decisión del pasillo.
   */
  profesor?: boolean;
};

export type Mundo = {
  ancho: number;
  alto: number;
  tiles: Uint8Array;
  puertas: Puerta[];
  /** Dónde arranca el jugador, en píxeles. */
  inicio: { x: number; y: number };
};

export function tileEn(m: Mundo, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= m.ancho || ty >= m.alto) return PARED;
  return m.tiles[ty * m.ancho + tx];
}

/** Sortea qué puede haber detrás de una puerta y qué hay de verdad. */
function armarLecturas(
  rng: Rng,
  materiaId: string,
  deformacion: number,
): {
  forma: string;
  lecturas: Puerta["lecturas"];
  sorteado: Suceso;
  enemigoId: string;
} {
  const propios = MATERIAS[materiaId].enemigos;
  // Deformación 1+: se cuelan enemigos de otras materias.
  const ajenos =
    deformacion >= 1
      ? [pick(rng, MATERIAS[pick(rng, MATERIA_IDS.filter((m) => m !== materiaId))].enemigos)]
      : [];
  const enemigoId = pick(rng, [...propios, ...ajenos]);

  const forma = pickWeighted(
    rng,
    FORMAS_PUERTA.map((f) => ({ item: f, weight: f.peso })),
  );

  /*
   * Los porcentajes salen enteros y suman 100 exacto. Antes eran pesos al azar
   * normalizados a decimales y se mostraban redondeados, así que una puerta
   * decía "37% 33% 31%" y encima no cerraba en 100.
   */
  const lecturas: Puerta["lecturas"] = [];
  if (forma.reparto.pelea) {
    lecturas.push({ suceso: "pelea", enemigoId, prob: forma.reparto.pelea });
  }
  if (forma.reparto.bendicion) {
    lecturas.push({ suceso: "bendicion", prob: forma.reparto.bendicion });
  }
  if (forma.reparto.juego) {
    lecturas.push({ suceso: "juego", prob: forma.reparto.juego });
  }

  // Se sortea contra los mismos números que ve el jugador.
  let roll = randInt(rng, 1, 100);
  let sorteado: Suceso = lecturas[lecturas.length - 1].suceso;
  for (const l of lecturas) {
    roll -= l.prob;
    if (roll <= 0) {
      sorteado = l.suceso;
      break;
    }
  }

  return { forma: forma.id, lecturas, sorteado, enemigoId };
}

/** Genera un tramo de pasillo con aulas a los costados y el profesor al fondo. */
export function generarPasillo(
  rng: Rng,
  opciones: {
    cantidadPuertas?: number;
    deformacion?: Record<string, number>;
  } = {},
): Mundo {
  const cantidadPuertas = opciones.cantidadPuertas ?? 5;
  const deformacion = opciones.deformacion ?? {};
  const ancho = 12 + cantidadPuertas * 6;
  const alto = 13;
  const tiles = new Uint8Array(ancho * alto).fill(PARED);

  // El pasillo es una banda horizontal. Termina antes del aula del profesor.
  const filaDesde = 5;
  const filaHasta = 7;
  const finPasillo = ancho - 7;
  for (let y = filaDesde; y <= filaHasta; y++) {
    for (let x = 1; x <= finPasillo; x++) tiles[y * ancho + x] = PISO;
  }

  /** Carva el interior visible de un aula. */
  const carvarSala = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x > 0 && y > 0 && x < ancho - 1 && y < alto - 1) {
          tiles[y * ancho + x] = SALA;
        }
      }
    }
  };

  const puertas: Puerta[] = [];
  for (let i = 0; i < cantidadPuertas; i++) {
    const x = 4 + i * 6;
    const arriba = i % 2 === 0;
    const y = arriba ? filaDesde - 1 : filaHasta + 1;
    // El aula detrás de la puerta, que se ve difuminada desde el pasillo.
    const sala = arriba
      ? { x0: x - 2, y0: 1, x1: x + 2, y1: filaDesde - 2 }
      : { x0: x - 2, y0: filaHasta + 2, x1: x + 2, y1: alto - 2 };
    carvarSala(sala.x0, sala.y0, sala.x1, sala.y1);
    tiles[y * ancho + x] = PUERTA;

    const materiaId = pick(rng, MATERIA_IDS);
    const cont = armarLecturas(rng, materiaId, deformacion[materiaId] ?? 0);
    puertas.push({ x, y, materiaId, ...cont, usada: false, sala });
  }

  // El aula del profesor: al fondo, ocupando todo el ancho que queda.
  const salaProf = {
    x0: finPasillo + 2,
    y0: filaDesde - 2,
    x1: ancho - 2,
    y1: filaHasta + 2,
  };
  carvarSala(salaProf.x0, salaProf.y0, salaProf.x1, salaProf.y1);
  const xFinal = finPasillo + 1;
  tiles[6 * ancho + xFinal] = PUERTA;
  const profesorId = pick(rng, PROFESORES);
  puertas.push({
    x: xFinal,
    y: 6,
    materiaId: profesorId.replace("prof_", ""),
    forma: "profesor",
    lecturas: [{ suceso: "pelea" as const, enemigoId: profesorId, prob: 100 }],
    sorteado: "pelea" as const,
    enemigoId: profesorId,
    usada: false,
    sala: salaProf,
    profesor: true,
  });

  return {
    ancho,
    alto,
    tiles,
    puertas,
    inicio: { x: 2 * TILE + TILE / 2, y: 6 * TILE + TILE / 2 },
  };
}

function chocaEn(m: Mundo, px: number, py: number): boolean {
  const mitad = CUERPO / 2;
  const x0 = Math.floor((px - mitad) / TILE);
  const x1 = Math.floor((px + mitad - 0.01) / TILE);
  const y0 = Math.floor((py - mitad) / TILE);
  const y1 = Math.floor((py + mitad - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileEn(m, tx, ty);
      // Las aulas se ven pero no se caminan: se entra por la puerta.
      if (t === PARED || t === SALA) return true;
    }
  }
  return false;
}

/**
 * Mueve resolviendo cada eje por separado: así rozar una pared en diagonal
 * te desliza en vez de frenarte en seco.
 */
export function mover(
  m: Mundo,
  pos: { x: number; y: number },
  dx: number,
  dy: number,
): { x: number; y: number } {
  let { x, y } = pos;
  if (dx !== 0 && !chocaEn(m, x + dx, y)) x += dx;
  if (dy !== 0 && !chocaEn(m, x, y + dy)) y += dy;
  return { x, y };
}

/** La puerta que tenés al lado, si hay alguna. */
export function puertaCerca(m: Mundo, pos: { x: number; y: number }): Puerta | null {
  for (const p of m.puertas) {
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2;
    if (Math.abs(cx - pos.x) < TILE * 0.8 && Math.abs(cy - pos.y) < TILE * 1.4) {
      return p;
    }
  }
  return null;
}
