/**
 * Catálogo de distorsiones.
 *
 * Cada distorsión es un objeto con interceptores opcionales que el motor
 * consulta en los puntos donde toma decisiones. Agregar una distorsión nueva
 * es agregar una entrada acá — nunca tocar el motor. Como el pool de
 * distorsiones *es* el juego, eso tiene que seguir siendo barato para siempre.
 *
 * Dos categorías, según la intensidad:
 *   - chicas: acumulables, ajustan parámetros. Son el tejido.
 *   - grandes: excluyentes (una sola activa), cambian una regla del motor.
 */

import type { Distortion, Reading } from "./types";
import { random, type Rng } from "./rng";

export const CHICAS: Distortion[] = [
  {
    id: "ojo-agudo",
    name: "Ojo agudo",
    tier: "chica",
    text: "Observar cuesta menos. Siempre costó menos.",
    verbCost: (verb, base) => (verb === "observar" ? base - 1 : base),
  },
  {
    id: "paso-corto",
    name: "Paso corto",
    tier: "chica",
    text: "Retirarte a tiempo te devuelve algo.",
    withdrawRefund: 1,
  },
  {
    id: "tiempo-espeso",
    name: "Tiempo espeso",
    tier: "chica",
    text: "Las cosas tardan más en volverse otra cosa.",
    maturationBonus: 1,
  },
  {
    id: "manos-firmes",
    name: "Manos firmes",
    tier: "chica",
    text: "Cuando sabés lo que hacés, te rinde más.",
    outcomeBonus: (informed) => (informed ? 1 : 0),
  },
];

export const GRANDES: Distortion[] = [
  {
    id: "numeros-mienten",
    name: "Los números mienten",
    tier: "grande",
    text: "Las probabilidades siguen ahí. Ya no dicen la verdad.",
    distortReadings: (readings: Reading[], rng: Rng) => {
      // Perturba lo declarado y renormaliza, para que el error no se note
      // por la suma. Lo real (`actual`) queda intacto: el motor sigue
      // tirando contra los números viejos.
      const perturbed = readings.map((r) => ({
        ...r,
        declared: Math.max(0.01, r.declared * (0.8 + random(rng) * 0.4)),
      }));
      const total = perturbed.reduce((a, r) => a + r.declared, 0);
      return perturbed.map((r) => ({ ...r, declared: r.declared / total }));
    },
  },
  {
    id: "silencio",
    name: "Silencio",
    tier: "grande",
    text: "Las salas dejan de anunciarse. Siguen siendo lo que son.",
    hideReadings: true,
  },
  {
    id: "lucidez",
    name: "Lucidez",
    tier: "grande",
    text: "Vas a saber qué hay antes de entrar. Vas a poder hacer una sola cosa.",
    revealBeforeEntering: true,
    maxActions: 1,
  },
  {
    id: "sin-noche",
    name: "No hay noche",
    tier: "grande",
    text: "Dejás de cansarte al andar. Dejás de decidir cuándo dormir.",
    freeEntry: true,
    noVoluntarySleep: true,
  },
];

export const ALL_DISTORTIONS: Distortion[] = [...CHICAS, ...GRANDES];

const BY_ID = new Map(ALL_DISTORTIONS.map((d) => [d.id, d]));

export function getDistortion(id: string): Distortion {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Distorsión desconocida: ${id}`);
  return d;
}
