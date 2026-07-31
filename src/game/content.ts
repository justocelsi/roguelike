/**
 * El contenido: las 6 materias y todo lo que cuelga de ellas.
 *
 * El vínculo materia → enemigos → arma es una regla generativa, no
 * ambientación. Si el aula es Matemática, la regla es un arma y el enemigo es
 * un teorema.
 *
 * Tono: terror onírico. El chico tiene insomnio hace días; nada de esto es
 * exactamente real y nada es exactamente un sueño.
 */

import type { Arma, Enemigo, Item, Materia } from "./types";

export const MATERIAS: Record<string, Materia> = {
  matematica: {
    id: "matematica",
    nombre: "Matemática",
    efecto: "confusion",
    enemigos: ["teorema", "demostracion", "problema"],
    armas: ["regla", "compas"],
    items: ["tiza", "cafe"],
  },
  literatura: {
    id: "literatura",
    nombre: "Literatura",
    efecto: "confusion",
    enemigos: ["libro", "narrador"],
    armas: ["diccionario"],
    items: ["apunte", "anteojos"],
  },
  historia: {
    id: "historia",
    nombre: "Historia",
    efecto: "miedo",
    enemigos: ["vuelve", "fecha"],
    armas: ["puntero"],
    items: ["apunte", "caramelo"],
  },
  biologia: {
    id: "biologia",
    nombre: "Biología",
    efecto: "miedo",
    enemigos: ["esqueleto", "formol"],
    armas: ["bisturi"],
    items: ["venda", "agua"],
  },
  quimica: {
    id: "quimica",
    nombre: "Química",
    efecto: "torpeza",
    enemigos: ["reaccion", "campana"],
    armas: ["mechero", "acido"],
    items: ["alcohol", "tiza"],
  },
  fisica: {
    id: "fisica",
    nombre: "Educación Física",
    efecto: "torpeza",
    enemigos: ["ultimo", "soga"],
    armas: ["pelota"],
    items: ["agua", "caramelo", "energizante"],
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
    vida: 26,
    patron: [
      { tell: "Empieza a reescribirse.", tipo: "golpe", impacto: "Se reescribe encima tuyo. Algo que era cierto deja de serlo.", daño: 7 , precision: 0.8 },
      { tell: "Se detiene. Falta un paso.", tipo: "efecto", efecto: "confusion" , precision: 0.85 },
      { tell: "Te muestra el resultado antes de la demostración.", tipo: "golpe", impacto: "Ves el final antes que el camino y ya no lo podés desver.", daño: 12 , precision: 0.8 },
    ],
  },
  demostracion: {
    id: "demostracion",
    nombre: "una demostración circular",
    vida: 30,
    patron: [
      { tell: "Vuelve al principio.", tipo: "golpe", impacto: "Volvés con él al mismo punto, sin haber avanzado.", daño: 6 , precision: 0.8 },
      { tell: "Vuelve al principio.", tipo: "espera" },
      { tell: "Vuelve al principio. Otra vez.", tipo: "golpe", impacto: "El círculo se cierra sobre vos.", daño: 14 , precision: 0.8 },
    ],
  },
  problema: {
    id: "problema",
    nombre: "un problema sin enunciado",
    vida: 20,
    patron: [
      { tell: "Espera una respuesta a algo que no preguntó.", tipo: "efecto", efecto: "confusion" , precision: 0.85 },
      { tell: "Se te acaba el tiempo.", tipo: "golpe", impacto: "Te sacan la hoja. No habías escrito nada.", daño: 10 , precision: 0.8 },
    ],
  },

  // --- Literatura ---
  libro: {
    id: "libro",
    nombre: "un libro que no termina",
    vida: 28,
    patron: [
      { tell: "Pasa una página sola.", tipo: "espera" },
      { tell: "Te nombra.", tipo: "golpe", impacto: "Dice tu nombre completo, con el segundo.", daño: 13 , precision: 0.8 },
      { tell: "La página que leíste ya dice otra cosa.", tipo: "efecto", efecto: "confusion" , precision: 0.85 },
    ],
  },
  narrador: {
    id: "narrador",
    nombre: "el narrador",
    vida: 24,
    patron: [
      { tell: "Describe lo que vas a hacer antes de que lo hagas.", tipo: "golpe", impacto: "Ya estaba escrito. Hacés exactamente eso.", daño: 8 , precision: 0.8 },
      { tell: "Se corrige.", tipo: "efecto", efecto: "confusion" , precision: 0.85 },
    ],
  },

  // --- Historia ---
  vuelve: {
    id: "vuelve",
    nombre: "algo que ya pasó y vuelve",
    vida: 26,
    patron: [
      { tell: "Ya hizo esto.", tipo: "golpe", impacto: "Te pasa de nuevo, igual que la primera vez.", daño: 8 , precision: 0.8 },
      { tell: "Lo vas a ver otra vez.", tipo: "efecto", efecto: "miedo" , precision: 0.85 },
      { tell: "Ya hizo esto y lo va a hacer.", tipo: "golpe", impacto: "Vuelve a pasar, y esta vez sabés cómo sigue.", daño: 13 , precision: 0.8 },
    ],
  },
  fecha: {
    id: "fecha",
    nombre: "la fecha que no te acordás",
    vida: 18,
    patron: [
      { tell: "Te mira esperando el número.", tipo: "efecto", efecto: "miedo" , precision: 0.85 },
      { tell: "Se cansa de esperar.", tipo: "golpe", impacto: "Te dice el número ella. Era obvio.", daño: 11 , precision: 0.8 },
    ],
  },

  // --- Biología ---
  esqueleto: {
    id: "esqueleto",
    nombre: "el esqueleto del aula",
    vida: 32,
    patron: [
      { tell: "Se descuelga del soporte.", tipo: "espera" },
      { tell: "Se acomoda las manos.", tipo: "golpe", imparable: true, impacto: "Te agarra justo donde tenés lo mismo que él.", daño: 14 , precision: 0.8 },
      { tell: "Te muestra dónde te falta algo.", tipo: "efecto", efecto: "miedo" , precision: 0.85 },
    ],
  },
  formol: {
    id: "formol",
    nombre: "lo que está en formol",
    vida: 24,
    patron: [
      { tell: "Se da vuelta adentro del frasco.", tipo: "efecto", efecto: "miedo" , precision: 0.85 },
      { tell: "El vidrio cede un poco.", tipo: "golpe", impacto: "Se derrama sobre vos y está tibio.", daño: 10 , precision: 0.8 },
    ],
  },

  // --- Química ---
  reaccion: {
    id: "reaccion",
    nombre: "algo que reacciona",
    vida: 22,
    patron: [
      { tell: "Empieza a burbujear.", tipo: "espera" },
      { tell: "Se expande.", tipo: "golpe", imparable: true, impacto: "Te llega el calor antes que el ruido.", daño: 15 , precision: 0.8 },
      { tell: "El aire se pone denso.", tipo: "efecto", efecto: "torpeza" , precision: 0.85 },
    ],
  },
  campana: {
    id: "campana",
    nombre: "la campana de gases",
    vida: 28,
    patron: [
      { tell: "El extractor se para.", tipo: "efecto", efecto: "torpeza" , precision: 0.85 },
      { tell: "Se llena.", tipo: "golpe", impacto: "Respirás algo que no era aire.", daño: 11 , precision: 0.8 },
    ],
  },

  // --- Educación Física ---
  ultimo: {
    id: "ultimo",
    nombre: "el que elige último",
    vida: 26,
    patron: [
      { tell: "Todavía no dijo tu nombre.", tipo: "efecto", efecto: "torpeza" , precision: 0.85 },
      { tell: "Sigue sin decirlo.", tipo: "golpe", impacto: "Te quedás parado mientras se arman los equipos.", daño: 9 , precision: 0.8 },
      { tell: "Señala a otro.", tipo: "golpe", impacto: "Señala a otro y todos miran para donde estás vos.", daño: 13 , precision: 0.8 },
    ],
  },
  soga: {
    id: "soga",
    nombre: "la soga",
    vida: 20,
    patron: [
      { tell: "Se tensa.", tipo: "golpe", impacto: "Te levanta unos centímetros y te suelta.", daño: 9 , precision: 0.8 },
      { tell: "Baja hasta donde llegás.", tipo: "efecto", efecto: "torpeza" , precision: 0.85 },
    ],
  },

  // --- Los profesores. Cierran el ciclo y no se pueden esquivar. ---
  prof_matematica: {
    id: "prof_matematica",
    nombre: "el que corrige en rojo",
    vida: 55,
    profesor: true,
    patron: [
      { tell: "Destapa la lapicera.", tipo: "espera" },
      { tell: "Tacha algo tuyo.", tipo: "golpe", impacto: "Tacha algo que habías hecho bien.", daño: 16 , precision: 0.9 },
      { tell: "Te muestra la hoja.", tipo: "efecto", efecto: "confusion" , precision: 0.9 },
      { tell: "Te mira mientras escribe.", tipo: "efecto", efecto: "miedo", precision: 0.9 },
      { tell: "Sigue corrigiendo.", tipo: "golpe", imparable: true, impacto: "Sigue. La hoja te queda entera en rojo.", daño: 20 , precision: 0.9 },
    ],
  },
  prof_biologia: {
    id: "prof_biologia",
    nombre: "la que sabe cómo sos por dentro",
    vida: 58,
    profesor: true,
    patron: [
      { tell: "Te pide que te quedes quieto.", tipo: "efecto", efecto: "miedo" , precision: 0.9 },
      { tell: "Señala exactamente el lugar.", tipo: "golpe", impacto: "Apoya el dedo justo donde duele.", daño: 18 , precision: 0.9 },
      { tell: "Espera a que respires.", tipo: "espera" },
      { tell: "Te toma el pulso.", tipo: "efecto", efecto: "torpeza", precision: 0.9 },
      { tell: "Ahí.", tipo: "golpe", imparable: true, impacto: "Ahí. Sabía dónde desde antes de que entraras.", daño: 22 , precision: 0.9 },
    ],
  },
  prof_quimica: {
    id: "prof_quimica",
    nombre: "el que no se saca los guantes",
    vida: 52,
    profesor: true,
    patron: [
      { tell: "Mide algo sin mirar.", tipo: "espera" },
      { tell: "Lo vuelca.", tipo: "golpe", impacto: "Lo vuelca sin apuro y se queda mirando cómo te toca.", daño: 19 , precision: 0.9 },
      { tell: "El aire se pone denso.", tipo: "efecto", efecto: "torpeza" , precision: 0.9 },
    ],
  },
  prof_historia: {
    id: "prof_historia",
    nombre: "el que estuvo ahí",
    vida: 56,
    profesor: true,
    patron: [
      { tell: "Se acuerda de vos.", tipo: "efecto", efecto: "miedo" , precision: 0.9 },
      { tell: "Cuenta cómo termina.", tipo: "golpe", impacto: "Te cuenta cómo termina, y termina así.", daño: 17 , precision: 0.9 },
      { tell: "Lo cuenta otra vez.", tipo: "golpe", impacto: "Lo repite igual, palabra por palabra.", daño: 17 , precision: 0.9 },
    ],
  },
  prof_literatura: {
    id: "prof_literatura",
    nombre: "la que te lee en voz alta",
    vida: 50,
    profesor: true,
    patron: [
      { tell: "Abre el cuaderno en tu página.", tipo: "espera" },
      { tell: "Empieza a leer.", tipo: "golpe", impacto: "Lee algo tuyo en voz alta.", daño: 15 , precision: 0.9 },
      { tell: "Todos escuchan.", tipo: "efecto", efecto: "confusion" , precision: 0.9 },
      { tell: "Sigue leyendo.", tipo: "golpe", impacto: "Sigue leyendo. Nadie se ríe, que es peor.", daño: 21 , precision: 0.9 },
    ],
  },
  prof_fisica: {
    id: "prof_fisica",
    nombre: "el que cuenta hasta diez",
    vida: 54,
    profesor: true,
    patron: [
      { tell: "Ocho.", tipo: "espera" },
      { tell: "Nueve.", tipo: "efecto", efecto: "torpeza" , precision: 0.9 },
      { tell: "Te mira a vos cuando cuenta.", tipo: "efecto", efecto: "miedo", precision: 0.9 },
      { tell: "Diez.", tipo: "golpe", imparable: true, impacto: "Diez. Se acabó el tiempo para todos.", daño: 24 , precision: 0.9 },
    ],
  },
};

export const PROFESORES = Object.keys(ENEMIGOS).filter(
  (id) => ENEMIGOS[id].profesor,
);

/**
 * Las infinitas pegan poco pero están siempre: son el piso de tu daño. Las de
 * usos contados son picos que hay que elegir cuándo gastar dentro de la pelea.
 */
export const ARMAS: Record<string, Arma> = {
  regla: { id: "regla", nombre: "la regla", daño: 14, usos: 5, precision: 0.9, desgaste: 0.05, critico: 0.1, texto: "Medís y cortás." },
  compas: { id: "compas", nombre: "el compás", daño: 18, usos: 4, precision: 0.8, desgaste: 0.05, critico: 0.15, texto: "La punta entra donde tiene que entrar." },
  diccionario: { id: "diccionario", nombre: "el diccionario", daño: 15, usos: 5, precision: 0.85, desgaste: 0.05, critico: 0.05, texto: "Pesa más de lo que debería." },
  puntero: { id: "puntero", nombre: "el puntero", daño: 16, usos: 0, infinita: true, precision: 0.85, desgaste: 0, critico: 0.1, texto: "Señalás y lo que señalás retrocede." },
  bisturi: { id: "bisturi", nombre: "el bisturí", daño: 22, usos: 3, precision: 0.8, desgaste: 0.05, critico: 0.25, texto: "Abrís sin resistencia." },
  mechero: { id: "mechero", nombre: "el mechero", daño: 17, usos: 4, precision: 0.8, desgaste: 0.05, critico: 0.15, texto: "La llama se estira hacia lo que mirás." },
  acido: { id: "acido", nombre: "el ácido", daño: 25, usos: 2, precision: 0.7, desgaste: 0.05, critico: 0.2, texto: "Lo que toca deja de tener forma." },
  pelota: { id: "pelota", nombre: "la pelota", daño: 12, usos: 0, infinita: true, perdida: 0.05, precision: 0.95, desgaste: 0, critico: 0.05, texto: "Pega y vuelve a tu mano." },
};

export const ITEMS: Record<string, Item> = {
  agua: {
    id: "agua",
    nombre: "la botella",
    descripcion: "Recuperás 15.",
    rareza: "comun",
    precision: 0.9,
    efecto: { vida: 15 },
  },
  apunte: {
    id: "apunte",
    nombre: "el apunte de otro",
    descripcion: "Letra ajena, pero clara. Te saca los estados que tengas encima.",
    rareza: "raro",
    precision: 0.95,
    efecto: { limpia: true },
  },
  caramelo: {
    id: "caramelo",
    nombre: "el caramelo del bolsillo",
    descripcion: "Recuperás 8.",
    rareza: "comun",
    precision: 0.95,
    efecto: { vida: 8 },
  },
  cafe: {
    id: "cafe",
    nombre: "el café de la sala",
    descripcion: "Todo lo que hagas pega 4 más por el resto de la pelea. Se acumula.",
    rareza: "raro",
    precision: 0.95,
    efecto: { buff: 4 },
  },
  anteojos: {
    id: "anteojos",
    nombre: "los anteojos de alguien",
    descripcion: "Lo ves venir y no te toca: el próximo golpe no te entra.",
    rareza: "unico",
    precision: 0.9,
    efecto: { escudo: true },
  },
  energizante: {
    id: "energizante",
    nombre: "la lata del quiosco",
    descripcion: "Perdés 4 por turno, pero te devuelve la mitad de lo que hacés.",
    rareza: "unico",
    precision: 0.9,
    efecto: { sangria: { porTurno: 4, robo: 0.5 } },
  },
  venda: {
    id: "venda",
    nombre: "la venda del botiquín",
    descripcion: "Recuperás 20.",
    rareza: "raro",
    precision: 0.95,
    efecto: { vida: 20 },
  },
  alcohol: {
    id: "alcohol",
    nombre: "el alcohol del laboratorio",
    descripcion: "Se lo tirás encima. 16 de daño.",
    rareza: "raro",
    precision: 0.7,
    efecto: { daño: 16 },
  },
  tiza: {
    id: "tiza",
    nombre: "la tiza",
    descripcion: "Se la tirás. 12 de daño.",
    rareza: "comun",
    precision: 0.75,
    efecto: { daño: 12 },
  },
};

/** Qué te hace cada estado. Se muestra al pasar por encima de su etiqueta. */
export const EXPLICACION_EFECTO: Record<string, string> = {
  confusion:
    "Los números de la pantalla se muestran mal. Tu vida, la del enemigo y los porcentajes dejan de ser confiables.",
  miedo:
    "Todo lo que hagas apunta 20 puntos peor. Ya está descontado en el número que muestra cada botón.",
  torpeza:
    "El enemigo actúa dos veces por cada turno tuyo, desde el turno siguiente. Cubrirte sigue valiendo para las dos.",
};

/** Cuántas veces más probable es una rareza frente a la de arriba. */
export const PESO_RAREZA: Record<string, number> = {
  comun: 6,
  raro: 3,
  unico: 1,
};

export const MATERIA_IDS = Object.keys(MATERIAS);
export const ITEM_IDS = Object.keys(ITEMS);

/** Cómo se llama la materia según cuánto se haya deformado. */
export function nombreMateria(materiaId: string, deformacion: number): string {
  const nombres = NOMBRES_DEFORMADOS[materiaId];
  return nombres[Math.min(deformacion, nombres.length - 1)];
}
