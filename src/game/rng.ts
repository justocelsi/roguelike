/**
 * RNG determinista y serializable. Todo el azar del juego pasa por acá.
 *
 * El estado del generador es un solo número, así que una partida entera queda
 * reproducible a partir de su semilla. Eso es lo que después hace posible la
 * semilla diaria compartida sin tocar el motor.
 */

export type Rng = { seed: number };

export function makeRng(seed: number): Rng {
  return { seed: seed | 0 };
}

/** mulberry32. Avanza el generador y devuelve un float en [0, 1). */
export function random(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(rng.seed ^ (rng.seed >>> 15), 1 | rng.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entero en [min, max], ambos inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(random(rng) * (max - min + 1));
}

/** Un elemento cualquiera del array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(random(rng) * items.length)];
}

/** `n` elementos distintos, sin repetir. */
export function pickMany<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(random(rng) * pool.length), 1)[0]);
  }
  return out;
}

/** Elige según pesos relativos. Los pesos no necesitan sumar 1. */
export function pickWeighted<T>(
  rng: Rng,
  items: readonly { item: T; weight: number }[],
): T {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let roll = random(rng) * total;
  for (const { item, weight } of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1].item;
}

/** Semilla desde el reloj, para runs no reproducibles. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) | 0;
}
