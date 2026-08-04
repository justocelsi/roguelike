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
    texto: "Por un momento ves con claridad. Te saca todos los estados que tengas encima, no uno.",
    usos: 2,
    precision: 0.95,
    efecto: { limpia: true },
  },
  parpadeo: {
    id: "parpadeo",
    nombre: "Parpadeo",
    texto: "Cerrás los ojos un segundo largo. Recuperás 22.",
    usos: 1,
    precision: 0.9,
    efecto: { vida: 22 },
  },
  memoria: {
    id: "memoria",
    nombre: "Memoria ajena",
    texto: "Alguien más se acuerda por vos. 14 de daño, y vos recuperás 8 de vida.",
    usos: 2,
    precision: 0.85,
    efecto: { daño: 14, vida: 8 },
  },
  campana: {
    id: "campana",
    nombre: "El timbre",
    texto: "Suena antes de tiempo. 16 de daño y te saca los estados que tengas encima.",
    usos: 1,
    precision: 0.85,
    efecto: { daño: 16, limpia: true },
  },
};

/**
 * Devolver un golpe sin haber bloqueado sólo pasa en sueños. Es el poder que
 * te deja hacer con una acción lo que despierto requiere leer el aviso bien.
 */
PODERES.espejo = {
  id: "espejo",
  nombre: "Espejo",
  texto:
    "Bloquear te sale un poco menos, pero lo que devolvés deja de ser un empujón. Devolvés 22 en vez de 5, y bloquear baja de 90% a 80%.",
  usos: 0,
  precision: 1,
  efecto: {},
  pasivo: { contraDaño: 17, contraPrecision: -0.1 },
};

/** Ver más lejos: el espejo exacto del defecto que te tapa el aviso. */
PODERES.ojera = {
  id: "ojera",
  nombre: "Ojera",
  texto:
    "De tanto no dormir empezaste a ver un paso más adelante. Además del aviso de este turno, ves el del siguiente.",
  usos: 0,
  precision: 1,
  efecto: {},
  pasivo: { verDoble: true },
};

/**
 * Pasivos que se disparan solos en un momento del combate, en vez de cuando
 * apretás un botón. Le dan textura al pool sin agregar acciones.
 */
PODERES.primera_hora = {
  id: "primera_hora",
  nombre: "Primera hora",
  texto: "Todavía te queda algo de la noche. Tu primer golpe de cada pelea pega el doble.",
  usos: 0,
  precision: 1,
  efecto: {},
  pasivo: { primerGolpeDoble: true },
};

PODERES.segundo_aire = {
  id: "segundo_aire",
  nombre: "Segundo aire",
  texto:
    "La primera vez que bajás de la mitad en una pelea, recuperás 14. Te levanta aunque el golpe te haya tumbado, una sola vez por aula.",
  usos: 0,
  precision: 1,
  efecto: {},
  pasivo: { red: 14 },
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
    texto: "Todo lo que te hacen duele un 35% más.",
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
  sin_aviso: {
    id: "sin_aviso",
    nombre: "Sin aviso",
    texto:
      "Dejás de ver lo que el otro va a hacer. Ya no lo leés: lo adivinás.",
    sinAviso: true,
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
