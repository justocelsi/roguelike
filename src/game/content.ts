/**
 * El contenido del juego: la gramática con la que se generan las salas y el
 * catálogo de eventos.
 *
 * Las salas no se escriben a mano, se componen. El lugar no tiene nombre pero
 * tiene gramática — eso da contenido infinito y además es lo que permite que
 * una distorsión les saque el nombre sin que se rompa nada.
 */

import type { GameEvent, Reading, Room } from "./types";
import { pick, pickMany, pickWeighted, randInt, random, type Rng } from "./rng";

const FORMAS = [
  "Una sala",
  "Un cuarto",
  "Un pasillo",
  "Una antesala",
  "Un hueco",
  "Algo parecido a una sala",
  "Un espacio",
] as const;

const CUALIDADES = [
  "donde el aire pesa",
  "sin esquinas",
  "que huele a metal frío",
  "demasiado alta",
  "que no estaba acá",
  "con una puerta de más",
  "donde el sonido llega tarde",
  "que alguien acaba de dejar",
  "más chica por dentro",
  "que ya recorriste",
  "en la que la luz no llega al piso",
  "sin polvo",
] as const;

export const EVENTS: Record<string, GameEvent> = {
  hallazgo: {
    id: "hallazgo",
    label: "algo aprovechable",
    reveal: "Es comida. Fue comida. Todavía sirve.",
    actVerb: "Tomar",
    blind: { vigilia: +2, text: "Tomás sin mirar. Algo sirve. No todo." },
    informed: { vigilia: +5, text: "Sabías qué agarrar. Te repone." },
    maturesTo: "nada",
  },
  resto: {
    id: "resto",
    label: "restos de alguien",
    reveal: "Estuvo acá mucho tiempo. Tiene las manos cerradas.",
    actVerb: "Registrar",
    blind: { vigilia: +1, text: "Le abrís las manos. Había algo. Casi nada." },
    informed: { vigilia: +4, text: "Sabías dónde buscar. Estaba ahí." },
    maturesTo: "presencia",
  },
  nada: {
    id: "nada",
    label: "nada",
    reveal: "Nada. Realmente nada. Es lo más raro que viste hoy.",
    actVerb: "Insistir",
    blind: { vigilia: -3, text: "Insistís un rato largo. No había nada." },
    informed: { vigilia: -1, text: "Ya sabías. Igual mirás. Igual nada." },
  },
  eco: {
    id: "eco",
    label: "un sonido que se repite",
    reveal: "Es tu propio paso, llegando tarde. Bastante tarde.",
    actVerb: "Escuchar",
    blind: {
      vigilia: -2,
      text: "Escuchás sin entender. Te quedás más tiempo del que querías.",
    },
    informed: {
      vigilia: +2,
      text: "Contás el desfasaje. Sabés cuánto tarda el lugar en devolverte.",
    },
    maturesTo: "presencia",
  },
  espejo: {
    id: "espejo",
    label: "vos",
    reveal: "Sos vos, desfasado. Hace lo que hiciste hace un rato.",
    actVerb: "Mirar",
    blind: {
      vigilia: -4,
      text: "Lo mirás demasiado. Te devuelve algo que no hiciste todavía.",
    },
    informed: {
      vigilia: +1,
      text: "Lo mirás sabiendo qué es. Se aburre antes que vos.",
    },
  },
  presencia: {
    id: "presencia",
    label: "algo que respira",
    reveal: "Respira lento. Está esperando que te decidas.",
    actVerb: "Enfrentar",
    hostile: true,
    blind: {
      vigilia: -7,
      text: "Te movés primero, sin saber contra qué. Sale mal.",
    },
    informed: {
      vigilia: -2,
      text: "Sabías dónde estaba. Salís con lo puesto, pero salís.",
    },
  },
};

/** Eventos que pueden aparecer en la oferta de una sala. */
const OFERTABLES = Object.keys(EVENTS);

export function generateRoom(rng: Rng, index: number): Room {
  const forma = pick(rng, FORMAS);
  const cualidad = pick(rng, CUALIDADES);
  const n = randInt(rng, 3, 4);
  const chosen = pickMany(rng, OFERTABLES, n);

  // Pesos crudos, después normalizados a probabilidades declaradas.
  const raw = chosen.map(() => randInt(rng, 1, 6));
  const total = raw.reduce((a, b) => a + b, 0);

  const readings: Reading[] = chosen.map((eventId, i) => {
    const p = raw[i] / total;
    // Por defecto el juego es honesto: lo declarado es lo real.
    return { eventId, declared: p, actual: p };
  });

  // El evento se sortea acá, contra las probabilidades *reales*.
  const rolled = pickWeighted(
    rng,
    readings.map((r) => ({ item: r.eventId, weight: r.actual })),
  );

  return {
    id: `sala-${index}-${Math.floor(random(rng) * 1e6)}`,
    name: `${forma} ${cualidad}`,
    readings,
    rolled,
  };
}

export function generateRooms(rng: Rng, n: number): Room[] {
  return Array.from({ length: n }, (_, i) => generateRoom(rng, i));
}
