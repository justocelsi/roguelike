/**
 * Los tres minijuegos que pueden aparecer detrás de una puerta.
 *
 * Todos hablan el mismo idioma que el resto: por turnos, pocas opciones, y una
 * sola decisión por vez. Cada uno prueba algo distinto —memoria, nervio y
 * atención— para que caer en uno no se sienta como caer siempre en el mismo.
 *
 * Puro: recibe estado y una elección, devuelve estado. La cuenta regresiva del
 * pizarrón vive en la interfaz, no acá.
 */

import { ENEMIGOS, ITEMS, MATERIA_IDS, MATERIAS, PESO_RAREZA } from "./content";
import { pick, pickMany, pickWeighted, randInt, type Rng } from "./rng";

export type TipoJuego = "pizarron" | "apuesta" | "examen";

export type Minijuego = {
  tipo: TipoJuego;
  /** Cuántos items te llevás cuando esto termine. */
  premio: number;
  terminado: boolean;
  /** Lo último que pasó, para contárselo al jugador. */
  cuento: string;
  /**
   * La tirada que resolvió el último paso, cuando la hubo.
   *
   * La apuesta es la única parte del juego afuera del combate donde el jugador
   * pone algo contra un porcentaje, así que se ve girar en el mismo reloj. Toda
   * apuesta del juego se ve: un número declarado que se resuelve en silencio es
   * lo mismo que un número escondido.
   */
  tirada?: { prob: number; salio: boolean };

  // --- el pizarrón: se te muestra algo y hay que reponerlo ---
  secuencia?: string[];
  puestos?: string[];
  /** De qué materias salen los símbolos que se muestran para elegir. */
  opcionesSimbolo?: string[];

  // --- la apuesta: seguís tentando o te vas con lo junto ---
  juntado?: number;
  /** Probabilidad de que el próximo paso salga bien, 0-100. */
  suerte?: number;

  // --- el examen: te preguntan por algo que ya venciste ---
  enemigoId?: string;
  opciones?: string[];
  correcta?: number;
};

const LARGO_PIZARRON = 4;

export function armarMinijuego(rng: Rng, sombras: string[]): Minijuego {
  // El examen sólo tiene sentido si ya venciste algo sobre lo que preguntar.
  const posibles: TipoJuego[] =
    sombras.length >= 3 ? ["pizarron", "apuesta", "examen"] : ["pizarron", "apuesta"];
  const tipo = pick(rng, posibles);

  if (tipo === "pizarron") {
    const opcionesSimbolo = [...MATERIA_IDS];
    const secuencia = Array.from({ length: LARGO_PIZARRON }, () =>
      pick(rng, opcionesSimbolo),
    );
    return {
      tipo,
      premio: 0,
      terminado: false,
      cuento: "Alguien escribió algo en el pizarrón y lo borró enseguida.",
      secuencia,
      puestos: [],
      opcionesSimbolo,
    };
  }

  if (tipo === "apuesta") {
    return {
      tipo,
      premio: 1,
      terminado: false,
      cuento: "Hay una caja abierta. Adentro hay más de lo que necesitás.",
      juntado: 1,
      suerte: 70,
    };
  }

  // Examen: se pregunta cuál de tres cosas hace un enemigo que ya venciste.
  const enemigoId = pick(rng, sombras);
  const suyo = pick(rng, ENEMIGOS[enemigoId].patron).tell;
  const otros = pickMany(
    rng,
    Object.values(ENEMIGOS)
      .filter((e) => e.id !== enemigoId)
      .flatMap((e) => e.patron.map((i) => i.tell))
      .filter((t) => t !== suyo),
    2,
  );
  const correcta = randInt(rng, 0, 2);
  const opciones = [...otros];
  opciones.splice(correcta, 0, suyo);

  return {
    tipo,
    premio: 0,
    terminado: false,
    cuento: "Hay una hoja con una sola pregunta.",
    enemigoId,
    opciones,
    correcta,
  };
}

/** Resuelve una elección. `eleccion` significa distinto en cada juego. */
export function jugar(j: Minijuego, eleccion: number, rng: Rng): Minijuego {
  if (j.terminado) return j;

  if (j.tipo === "pizarron") {
    const puestos = [...(j.puestos ?? []), j.opcionesSimbolo![eleccion]];
    if (puestos.length < j.secuencia!.length) {
      return { ...j, puestos };
    }
    const aciertos = puestos.filter((p, i) => p === j.secuencia![i]).length;
    // Todo bien paga doble; casi bien paga uno; menos que eso, nada.
    const premio = aciertos === j.secuencia!.length ? 2 : aciertos >= 3 ? 1 : 0;
    return {
      ...j,
      puestos,
      premio,
      terminado: true,
      cuento:
        premio === 2
          ? "Era exactamente eso. Te acordabas."
          : premio === 1
            ? `Casi. Te acordabas de ${aciertos} de ${j.secuencia!.length}.`
            : `Sólo ${aciertos} de ${j.secuencia!.length}. No era eso.`,
    };
  }

  if (j.tipo === "apuesta") {
    // 0 = me voy con lo junto. 1 = sigo.
    if (eleccion === 0) {
      return {
        ...j,
        premio: j.juntado!,
        terminado: true,
        cuento: `Te vas con ${j.juntado}. No hacía falta más.`,
        // Irse no es una apuesta: el reloj no tiene nada que resolver.
        tirada: undefined,
      };
    }
    const salio = randInt(rng, 1, 100) <= j.suerte!;
    const tirada = { prob: j.suerte!, salio };
    if (salio) {
      return {
        ...j,
        juntado: j.juntado! + 1,
        // Cada paso que sale bien vuelve el siguiente más difícil.
        suerte: Math.max(25, j.suerte! - 15),
        cuento: "Entra otro. Todavía no pasó nada.",
        tirada,
      };
    }
    return {
      ...j,
      juntado: 0,
      premio: 0,
      terminado: true,
      cuento: "Se cae todo. No te queda nada de lo que juntaste.",
      tirada,
    };
  }

  // Examen.
  const bien = eleccion === j.correcta;
  return {
    ...j,
    premio: bien ? 2 : 0,
    terminado: true,
    cuento: bien
      ? "Era eso. Prestaste atención."
      : "No era eso. Lo habías tenido enfrente.",
  };
}

/** El enunciado de la pregunta del examen. */
export function preguntaDe(j: Minijuego): string {
  return `¿Qué anuncia ${ENEMIGOS[j.enemigoId!].nombre} antes de moverse?`;
}

/**
 * Los items que da un premio, siempre de la materia del aula.
 *
 * Pondera por rareza igual que el botín de un combate: si no lo hiciera, un
 * minijuego —o peor, una bendición, que no cuesta nada— repartiría únicos con
 * la misma frecuencia que tizas, y encontrar algo raro dejaría de significar
 * nada. `soloComun` es para la bendición: sale gratis, así que da lo básico.
 */
export function premioDe(
  rng: Rng,
  materiaId: string,
  cuantos: number,
  soloComun = false,
): string[] {
  let bolsa = MATERIAS[materiaId]?.items ?? [];
  if (soloComun) {
    const comunes = bolsa.filter((id) => ITEMS[id].rareza === "comun");
    // Toda materia tiene alguno, pero si alguna vez no lo tuviera, mejor dar
    // algo que no dar nada.
    if (comunes.length) bolsa = comunes;
  }
  if (!bolsa.length || cuantos <= 0) return [];
  return Array.from({ length: cuantos }, () =>
    pickWeighted(
      rng,
      bolsa.map((id) => ({ item: id, weight: PESO_RAREZA[ITEMS[id].rareza] })),
    ),
  );
}
