/**
 * El pasillo: mapa de tiles y física de movimiento.
 *
 * Puro, sin canvas ni DOM. El renderer sólo lee de acá. Movimiento continuo
 * (no por casillas) con colisión AABB contra la grilla.
 */

import { pick, pickMany, randInt, random, type Rng } from "./rng";
import { MATERIAS, MATERIA_IDS, PROFESORES } from "./content";

export const TILE = 16;
/** Ancho del jugador en píxeles. Un poco menor que un tile para no trabarse. */
export const CUERPO = 10;
export const VELOCIDAD = 62; // px por segundo

export const PISO = 0;
export const PARED = 1;
export const PUERTA = 2;

export type Puerta = {
  x: number;
  y: number;
  materiaId: string;
  /** Lo que puede haber adentro, con su probabilidad. Se lee al acercarse. */
  lecturas: { enemigoId: string; prob: number }[];
  /** Lo que realmente hay. */
  sorteado: string;
  usada: boolean;
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
): { lecturas: { enemigoId: string; prob: number }[]; sorteado: string } {
  const propios = MATERIAS[materiaId].enemigos;
  // Deformación 1+: se cuelan enemigos de otras materias.
  const ajenos =
    deformacion >= 1
      ? [pick(rng, MATERIAS[pick(rng, MATERIA_IDS.filter((m) => m !== materiaId))].enemigos)]
      : [];
  const pool = [...propios, ...ajenos];

  const elegidos = pickMany(rng, pool, Math.min(3, pool.length));
  const pesos = elegidos.map(() => randInt(rng, 1, 5));
  const total = pesos.reduce((a, b) => a + b, 0);
  const lecturas = elegidos.map((enemigoId, i) => ({
    enemigoId,
    prob: pesos[i] / total,
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
  return { lecturas, sorteado };
}

/** Genera un tramo de pasillo con aulas a los costados y el profesor al fondo. */
export function generarPasillo(
  rng: Rng,
  opciones: { cantidadPuertas?: number; deformacion?: Record<string, number> } = {},
): Mundo {
  const cantidadPuertas = opciones.cantidadPuertas ?? 5;
  const deformacion = opciones.deformacion ?? {};
  const ancho = 8 + cantidadPuertas * 6;
  const alto = 13;
  const tiles = new Uint8Array(ancho * alto).fill(PARED);

  // El pasillo es una banda horizontal.
  const filaDesde = 5;
  const filaHasta = 7;
  for (let y = filaDesde; y <= filaHasta; y++) {
    for (let x = 1; x < ancho - 1; x++) tiles[y * ancho + x] = PISO;
  }

  const puertas: Puerta[] = [];
  for (let i = 0; i < cantidadPuertas; i++) {
    const x = 4 + i * 6;
    const arriba = i % 2 === 0;
    const y = arriba ? filaDesde - 1 : filaHasta + 1;
    tiles[y * ancho + x] = PUERTA;
    const materiaId = pick(rng, MATERIA_IDS);
    const { lecturas, sorteado } = armarLecturas(
      rng,
      materiaId,
      deformacion[materiaId] ?? 0,
    );
    puertas.push({ x, y, materiaId, lecturas, sorteado, usada: false });
  }

  // La puerta del fondo: el profesor. Siempre disponible.
  const xFinal = ancho - 2;
  tiles[6 * ancho + xFinal] = PUERTA;
  const profesorId = pick(rng, PROFESORES);
  puertas.push({
    x: xFinal,
    y: 6,
    materiaId: profesorId.replace("prof_", ""),
    lecturas: [{ enemigoId: profesorId, prob: 1 }],
    sorteado: profesorId,
    usada: false,
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
      if (tileEn(m, tx, ty) === PARED) return true;
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
