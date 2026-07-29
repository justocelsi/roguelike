/**
 * Poderes y defectos. Se sortean por separado: 6 × 6 = 36 ofertas distintas
 * con la mitad del contenido escrito.
 *
 * Los defectos son interceptores sobre el motor. Agregar uno nuevo es agregar
 * un objeto acá, nunca tocar el motor.
 */

import type { Defecto, Poder } from "./types";

export const PODERES: Record<string, Poder> = {
  insomnio: {
    id: "insomnio",
    nombre: "Insomnio",
    texto: "Lo que no dormiste se te devuelve de golpe. 25 de daño.",
    usos: 1,
    precision: 0.85,
    efecto: { daño: 25 },
  },
  repaso: {
    id: "repaso",
    nombre: "Repaso",
    texto: "Volver sobre lo que ya sabías. Recuperás 18.",
    usos: 1,
    precision: 0.9,
    efecto: { vida: 18 },
  },
  lucidez: {
    id: "lucidez",
    nombre: "Lucidez",
    texto: "Por un momento ves con claridad. Te saca todo lo que tengas encima.",
    usos: 2,
    precision: 0.95,
    efecto: { limpia: true },
  },
  parpadeo: {
    id: "parpadeo",
    nombre: "Parpadeo",
    texto: "Cerrás los ojos un segundo largo. Recuperás 22.",
    usos: 1,
    precision: 0.88,
    efecto: { vida: 22 },
  },
  memoria: {
    id: "memoria",
    nombre: "Memoria ajena",
    texto: "Alguien más se acuerda por vos. 14 de daño y recuperás 8.",
    usos: 2,
    precision: 0.85,
    efecto: { daño: 14, vida: 8 },
  },
  campana: {
    id: "campana",
    nombre: "El timbre",
    texto: "Suena antes de tiempo. 16 de daño y te saca los efectos.",
    usos: 1,
    precision: 0.85,
    efecto: { daño: 16, limpia: true },
  },
};

export const DEFECTOS: Record<string, Defecto> = {
  manos_frias: {
    id: "manos_frias",
    nombre: "Manos frías",
    texto: "Todo lo que hacés pega un cuarto menos.",
    daño: (base) => Math.max(1, Math.round(base * 0.75)),
  },
  piel_fina: {
    id: "piel_fina",
    nombre: "Piel fina",
    texto: "Todo lo que te hacen duele un tercio más.",
    recibido: (base) => Math.round(base * 1.35),
  },
  sueño_corto: {
    id: "sueño_corto",
    nombre: "Sueño corto",
    texto: "Nunca descansás del todo. Perdés 8 de vida máxima.",
    vidaMax: (base) => Math.max(15, base - 8),
  },
  sin_salida: {
    id: "sin_salida",
    nombre: "Sin salida",
    texto: "Las puertas se cierran atrás tuyo. No podés huir.",
    sinHuida: true,
  },
  menos_puertas: {
    id: "menos_puertas",
    nombre: "Menos puertas",
    texto: "El pasillo se angosta. Hay dos aulas menos antes del profesor.",
    menosPuertas: true,
  },
  resaca: {
    id: "resaca",
    nombre: "Resaca",
    texto: "Lo que te agarra tarda más en soltarte.",
    efectosLargos: true,
  },
};

export const PODER_IDS = Object.keys(PODERES);
export const DEFECTO_IDS = Object.keys(DEFECTOS);
