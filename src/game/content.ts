/**
 * El contenido: las 6 materias y todo lo que cuelga de ellas.
 *
 * El vínculo materia → enemigos → arma → atributo lastimado es una regla
 * generativa, no ambientación. Si el aula es Matemática, la regla es un arma y
 * el enemigo es un teorema. Eso le da al jugador un modelo mental que puede
 * usar para elegir, y le da al juego contenido coherente sin escribir un guión.
 *
 * Tono: terror onírico. Serio, sin guiños.
 */

import type { Arma, Enemigo, Item, Materia } from "./types";

export const MATERIAS: Record<string, Materia> = {
  matematica: {
    id: "matematica",
    nombre: "Matemática",
    atributo: "conocimiento",
    efecto: "confusion",
    enemigos: ["teorema", "demostracion", "problema"],
    armas: ["regla", "compas"],
  },
  literatura: {
    id: "literatura",
    nombre: "Literatura",
    atributo: "conocimiento",
    efecto: "confusion",
    enemigos: ["libro", "narrador"],
    armas: ["diccionario"],
  },
  historia: {
    id: "historia",
    nombre: "Historia",
    atributo: "nervio",
    efecto: "miedo",
    enemigos: ["vuelve", "fecha"],
    armas: ["puntero"],
  },
  biologia: {
    id: "biologia",
    nombre: "Biología",
    atributo: "nervio",
    efecto: "miedo",
    enemigos: ["esqueleto", "formol"],
    armas: ["bisturi"],
  },
  quimica: {
    id: "quimica",
    nombre: "Química",
    atributo: "reflejos",
    efecto: "torpeza",
    enemigos: ["reaccion", "campana"],
    armas: ["mechero", "acido"],
  },
  fisica: {
    id: "fisica",
    nombre: "Educación Física",
    atributo: "reflejos",
    efecto: "torpeza",
    enemigos: ["ultimo", "soga"],
    armas: ["pelota"],
  },
};

/** Cómo se llama cada materia a medida que se deforma. Índice = deformación. */
export const NOMBRES_DEFORMADOS: Record<string, string[]> = {
  matematica: ["Matemática", "Cálculo", "Contar", "Lo que no cierra"],
  literatura: ["Literatura", "Lengua", "Leer", "Lo que sigue escribiéndose"],
  historia: ["Historia", "Cívica", "Antes", "Lo que vuelve"],
  biologia: ["Biología", "Naturales", "Cuerpos", "Lo que había adentro"],
  quimica: ["Química", "Fisicoquímica", "Mezclas", "Lo que no se separa"],
  fisica: ["Educación Física", "Gimnasia", "Correr", "Lo que te alcanza"],
};

export const ENEMIGOS: Record<string, Enemigo> = {
  // --- Matemática ---
  teorema: {
    id: "teorema",
    nombre: "un teorema que no cierra",
    vida: 22,
    debilidad: "resolver",
    xp: 10,
    patron: [
      { tell: "Empieza a reescribirse.", tipo: "golpe", daño: 6 },
      {
        tell: "Se detiene. Falta un paso y no sabés cuál.",
        tipo: "efecto",
        efecto: "confusion",
      },
      {
        tell: "Te muestra el resultado antes de la demostración.",
        tipo: "golpe",
        daño: 9,
      },
    ],
  },
  demostracion: {
    id: "demostracion",
    nombre: "una demostración circular",
    vida: 28,
    debilidad: "aguantar",
    xp: 12,
    patron: [
      { tell: "Vuelve al principio.", tipo: "golpe", daño: 5 },
      { tell: "Vuelve al principio.", tipo: "golpe", daño: 5 },
      { tell: "Vuelve al principio. Otra vez.", tipo: "golpe", daño: 11 },
    ],
  },
  problema: {
    id: "problema",
    nombre: "un problema sin enunciado",
    vida: 18,
    debilidad: "resolver",
    xp: 9,
    patron: [
      {
        tell: "Espera una respuesta a algo que no preguntó.",
        tipo: "efecto",
        efecto: "confusion",
      },
      { tell: "Se te acaba el tiempo.", tipo: "golpe", daño: 8 },
    ],
  },

  // --- Literatura ---
  libro: {
    id: "libro",
    nombre: "un libro que no termina",
    vida: 26,
    debilidad: "resolver",
    xp: 11,
    patron: [
      { tell: "Pasa una página sola.", tipo: "espera" },
      { tell: "Te nombra.", tipo: "golpe", daño: 10 },
      {
        tell: "La página que leíste ya dice otra cosa.",
        tipo: "efecto",
        efecto: "confusion",
      },
    ],
  },
  narrador: {
    id: "narrador",
    nombre: "el narrador",
    vida: 20,
    debilidad: "aguantar",
    xp: 12,
    patron: [
      {
        tell: "Describe lo que vas a hacer antes de que lo hagas.",
        tipo: "golpe",
        daño: 7,
      },
      { tell: "Se corrige.", tipo: "efecto", efecto: "confusion" },
    ],
  },

  // --- Historia ---
  vuelve: {
    id: "vuelve",
    nombre: "algo que ya pasó y vuelve",
    vida: 24,
    debilidad: "aguantar",
    xp: 11,
    patron: [
      { tell: "Ya hizo esto.", tipo: "golpe", daño: 7 },
      { tell: "Lo vas a ver otra vez.", tipo: "efecto", efecto: "miedo" },
      { tell: "Ya hizo esto y lo va a hacer.", tipo: "golpe", daño: 10 },
    ],
  },
  fecha: {
    id: "fecha",
    nombre: "la fecha que no te acordás",
    vida: 16,
    debilidad: "resolver",
    xp: 8,
    patron: [
      { tell: "Te mira esperando el número.", tipo: "efecto", efecto: "miedo" },
      { tell: "Se cansa de esperar.", tipo: "golpe", daño: 9 },
    ],
  },

  // --- Biología ---
  esqueleto: {
    id: "esqueleto",
    nombre: "el esqueleto del aula",
    vida: 30,
    debilidad: "esquivar",
    xp: 13,
    patron: [
      { tell: "Se descuelga del soporte.", tipo: "espera" },
      { tell: "Se acomoda las manos.", tipo: "golpe", daño: 11 },
      { tell: "Te muestra dónde te falta algo.", tipo: "efecto", efecto: "miedo" },
    ],
  },
  formol: {
    id: "formol",
    nombre: "lo que está en formol",
    vida: 22,
    debilidad: "aguantar",
    xp: 12,
    patron: [
      { tell: "Se da vuelta adentro del frasco.", tipo: "efecto", efecto: "miedo" },
      { tell: "El vidrio cede un poco.", tipo: "golpe", daño: 8 },
    ],
  },

  // --- Química ---
  reaccion: {
    id: "reaccion",
    nombre: "algo que reacciona",
    vida: 20,
    debilidad: "esquivar",
    xp: 11,
    patron: [
      { tell: "Empieza a burbujear.", tipo: "espera" },
      { tell: "Se expande.", tipo: "golpe", daño: 12 },
      { tell: "El aire se pone denso.", tipo: "efecto", efecto: "torpeza" },
    ],
  },
  campana: {
    id: "campana",
    nombre: "la campana de gases",
    vida: 26,
    debilidad: "aguantar",
    xp: 12,
    patron: [
      { tell: "El extractor se para.", tipo: "efecto", efecto: "torpeza" },
      { tell: "Se llena.", tipo: "golpe", daño: 9 },
    ],
  },

  // --- Educación Física ---
  ultimo: {
    id: "ultimo",
    nombre: "el que elige último",
    vida: 24,
    debilidad: "aguantar",
    xp: 11,
    patron: [
      { tell: "Todavía no dijo tu nombre.", tipo: "efecto", efecto: "torpeza" },
      { tell: "Sigue sin decirlo.", tipo: "golpe", daño: 8 },
      { tell: "Señala a otro.", tipo: "golpe", daño: 11 },
    ],
  },
  soga: {
    id: "soga",
    nombre: "la soga",
    vida: 18,
    debilidad: "esquivar",
    xp: 9,
    patron: [
      { tell: "Se tensa.", tipo: "golpe", daño: 7 },
      { tell: "Baja hasta donde llegás.", tipo: "efecto", efecto: "torpeza" },
    ],
  },
};

export const ARMAS: Record<string, Arma> = {
  regla: { id: "regla", nombre: "la regla", daño: 7, texto: "Medís y cortás." },
  compas: {
    id: "compas",
    nombre: "el compás",
    daño: 10,
    texto: "La punta entra donde tiene que entrar.",
  },
  diccionario: {
    id: "diccionario",
    nombre: "el diccionario",
    daño: 8,
    texto: "Pesa más de lo que debería.",
  },
  puntero: {
    id: "puntero",
    nombre: "el puntero",
    daño: 8,
    texto: "Señalás y lo que señalás retrocede.",
  },
  bisturi: {
    id: "bisturi",
    nombre: "el bisturí",
    daño: 12,
    texto: "Abrís sin resistencia.",
  },
  mechero: {
    id: "mechero",
    nombre: "el mechero",
    daño: 9,
    texto: "La llama se estira hacia lo que mirás.",
  },
  acido: {
    id: "acido",
    nombre: "el ácido",
    daño: 13,
    texto: "Lo que toca deja de tener forma.",
  },
  pelota: {
    id: "pelota",
    nombre: "la pelota",
    daño: 6,
    texto: "Pega y vuelve a tu mano.",
  },
};

export const ITEMS: Record<string, Item> = {
  agua: {
    id: "agua",
    nombre: "la botella",
    descripcion: "Tomar algo. Recuperás 12.",
    efecto: { vida: 12 },
  },
  apunte: {
    id: "apunte",
    nombre: "el apunte de otro",
    descripcion: "Letra ajena, pero clara. Te saca lo que tengas encima.",
    efecto: { limpia: true },
  },
  caramelo: {
    id: "caramelo",
    nombre: "el caramelo del fondo del bolsillo",
    descripcion: "Poca cosa. Recuperás 6.",
    efecto: { vida: 6 },
  },
  tiza: {
    id: "tiza",
    nombre: "la tiza",
    descripcion: "Se la tirás. 10 de daño.",
    efecto: { daño: 10 },
  },
};

export const MATERIA_IDS = Object.keys(MATERIAS);
export const ITEM_IDS = Object.keys(ITEMS);

/** Cómo se llama la materia según cuánto se haya deformado. */
export function nombreMateria(materiaId: string, deformacion: number): string {
  const nombres = NOMBRES_DEFORMADOS[materiaId];
  return nombres[Math.min(deformacion, nombres.length - 1)];
}
