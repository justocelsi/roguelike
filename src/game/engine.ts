/**
 * El motor. Un reducer puro: (State, Action) => State.
 *
 * Sin atributos, sin niveles, sin XP. Una sola barra de vida y cinco acciones.
 * La dificultad no sale de los números sino de leer lo que el enemigo avisa
 * que va a hacer y decidir si pegás o te cubrís.
 *
 * El movimiento no pasa por acá: el pasillo lo maneja el renderer y sólo
 * dispara eventos discretos (entrar a un aula). El reducer no sabe de píxeles.
 */

import {
  ARMAS,
  ENEMIGOS,
  ITEMS,
  ITEM_IDS,
  MATERIAS,
  MATERIA_IDS,
  PESO_RAREZA,
  nombreMateria,
} from "./content";
import { generarPasillo, type Mundo } from "./mundo";
import {
  armarMinijuego,
  jugar,
  premioDe,
  type Minijuego,
} from "./minijuegos";
import { DEFECTOS, DEFECTO_IDS, PODERES, PODER_IDS } from "./poderes";
import {
  makeRng,
  pick,
  pickMany,
  pickWeighted,
  random,
  randomSeed,
  type Rng,
} from "./rng";
import type {
  Accion,
  Action,
  Combate,
  Defecto,
  Efecto,
  Entrada,
  Jugador,
  State,
} from "./types";

export const CICLOS = 5;
export const VIDA_BASE = 45;
/**
 * Daño del ataque a mano limpia. Bajo a propósito: un pibe sin nada en la
 * mano no le hace gran cosa a esto. El arma es lo que hacés en los turnos en
 * que no te estás cubriendo, y por eso vale la pena entrar a las aulas.
 */
export const DAÑO_ATAQUE = Number(process.env.NEXT_PUBLIC_PUNO ?? 6);
/**
 * Cubrirte justo cuando venía el golpe no sólo lo amortigua: contraatacás.
 * Sin esto, leer bien el aviso te costaba la mitad de tu daño y esperar era
 * siempre una pérdida.
 */
/**
 * Lo que devuelve un bloqueo: la mitad de un golpe a mano limpia. Nunca puede
 * superar a atacar, o no habría razón para atacar cuando ves venir un golpe.
 */
export const DAÑO_CONTRA = Number(process.env.NEXT_PUBLIC_CONTRA ?? 5);
/**
 * Cuánto del golpe pasa igual cuando bloqueás bien. No es cero a propósito:
 * si bloquear anulara todo, no existiría la opción de correr a matarlo antes
 * de que llegue a pegarte.
 */
/**
 * Un bloqueo que sale para el golpe entero. Lo que hace que bloquear no sea
 * siempre la respuesta no es que deje pasar algo, sino que hay golpes
 * imparables y que bloquear no hace daño.
 */
export const PASA_BLOQUEANDO = Number(process.env.NEXT_PUBLIC_PASA ?? 0);
/**
 * Perilla global del daño enemigo. Se afina midiendo, no a ojo.
 *
 * Bajó a 1,35 cuando las puertas dejaron de ser todas peleas —menos combates es
 * menos equipo— y subió a 1,65 cuando USAR pasó a ser gratis para las tres
 * cosas del menú y el bloqueo empezó a parar el golpe entero de verdad. Los
 * arreglos de claridad del combate le devolvieron al jugador ~15 puntos.
 */
const MULT_ENEMIGO = Number(process.env.NEXT_PUBLIC_MULT_ENEMIGO ?? 1.65);

/**
 * Nada acierta siempre, de ningún lado. La regla que mantiene esto justo es
 * que el número esté siempre a la vista: el azar escondido se siente tramposo,
 * el azar declarado es una apuesta que tomó el jugador.
 *
 * Las dos acciones que premian leer bien el aviso son las que mejor apuntan.
 */
export const PRECISION_ATAQUE = 0.9;
/**
 * Bloquear no siempre sale. Cuando sale, para el golpe **y** le devolvés:
 * es una sola tirada y un solo resultado, para que se entienda de una.
 */
export const EFECTIVIDAD_BLOQUEO = Number(process.env.NEXT_PUBLIC_BLOQ ?? 0.9);
/** Ningún arma baja de acá por más gastada que esté. */
const PRECISION_MINIMA = 0.35;

/**
 * Cuánta puntería te saca el miedo. **Resta, no multiplica.**
 *
 * Multiplicando, el miedo sobre un 90% daba 63% y ningún número de la pantalla
 * caía redondo. Restando, todo lo que se muestra queda en múltiplos de 5 —que
 * es lo que se puede pensar de cabeza en el medio de un turno— y la regla se
 * dice en una línea: *con miedo, todo lo que hagas apunta 20 puntos peor*.
 */
export const RESTA_MIEDO = 0.2;

/**
 * La puntería real de algo, ya con el miedo descontado. Es el número que
 * muestra el botón, el que se tira, y el que gira en el reloj: los tres salen
 * de acá para que no puedan separarse.
 */
export function punteria(state: State, base: number): number {
  return tieneEfecto(state, "miedo") ? Math.max(0, base - RESTA_MIEDO) : base;
}

/**
 * Deja anotada la tirada que resolvió un evento.
 *
 * Toma la chance **ya calculada**, la misma variable contra la que se tiró el
 * dado. Antes recibía la base y volvía a aplicarle el miedo por su cuenta, y esa
 * segunda cuenta se desincronizó dos veces: el reloj declaraba un arco y el
 * resultado salía de otro.
 */
function conTirada(chance: number, salio: boolean) {
  return { tirada: { prob: Math.round(chance * 100), salio } };
}

/** Cuántas armas entran en la mochila. Llenarla obliga a elegir. */
export const MAX_ARMAS = 3;

/**
 * Cuánto devuelve y con qué probabilidad sale el bloqueo, ya con los pasivos
 * del sueño aplicados. La interfaz muestra estos números, no los de base.
 */
/** Junta los pasivos de todos los poderes que tengas. */
export function pasivos(state: State) {
  const suma = {
    contraDaño: 0,
    contraPrecision: 0,
    verDoble: false,
    primerGolpeDoble: false,
    red: 0,
  };
  for (const id of state.jugador.poderes) {
    const p = PODERES[id].pasivo;
    if (!p) continue;
    suma.contraDaño += p.contraDaño ?? 0;
    suma.contraPrecision += p.contraPrecision ?? 0;
    suma.verDoble ||= !!p.verDoble;
    suma.primerGolpeDoble ||= !!p.primerGolpeDoble;
    suma.red = Math.max(suma.red, p.red ?? 0);
  }
  return suma;
}

/**
 * Los avisos que el jugador tiene derecho a ver. Normalmente uno; con torpeza
 * encima son dos, porque el enemigo va a actuar dos veces y todo lo que te
 * pasa tiene que haber estado anunciado. El pasivo "verDoble" suma uno más.
 */
export function avisos(state: State) {
  const c = state.combate;
  if (!c || !veElAviso(state)) return [];
  const patron = ENEMIGOS[c.enemigoId].patron;
  let cuantos = tieneEfecto(state, "torpeza") ? 2 : 1;
  if (pasivos(state).verDoble) cuantos += 1;
  return Array.from({ length: cuantos }, (_, i) => patron[(c.paso + i) % patron.length]);
}

export function bloqueoDe(state: State): { daño: number; precision: number } {
  const p = pasivos(state);
  return {
    daño: DAÑO_CONTRA + p.contraDaño,
    precision: Math.max(0.35, Math.min(1, EFECTIVIDAD_BLOQUEO + p.contraPrecision)),
  };
}

/** Usos que le quedan a un arma en este combate. Se recargan en el próximo. */
export function usosArma(state: State, armaId: string): number {
  const arma = ARMAS[armaId];
  if (arma.infinita) return Infinity;
  return arma.usos - (state.combate?.armasUsadas[armaId] ?? 0);
}

/**
 * Precisión actual del arma: el filo se pierde dentro del combate y vuelve
 * entero en el siguiente. Es un arco de una pelea, no de una run.
 */
export function precisionArma(state: State, armaId: string): number {
  const arma = ARMAS[armaId];
  const usados = state.combate?.armasUsadas[armaId] ?? 0;
  return Math.max(PRECISION_MINIMA, arma.precision - usados * arma.desgaste);
}

/**
 * Lo que acierta un arma tuya **ahora mismo**: con el desgaste de esta pelea y
 * con el miedo si lo tenés. Es la única cuenta correcta para mostrar en
 * pantalla, y existe como función para que no haya dos versiones dando vueltas.
 */
export function punteriaArma(state: State, armaId: string): number {
  return punteria(state, precisionArma(state, armaId));
}

/** Las armas que podés usar ahora mismo. */
export function armasUsables(state: State): string[] {
  return state.jugador.armas.filter((id) => usosArma(state, id) > 0);
}

export function usosPoder(state: State, id: string): number {
  return PODERES[id].usos - (state.combate?.poderesUsados[id] ?? 0);
}
const DURACION_EFECTO = 2;

/** El colegio empeora por ciclo. Sin esto, el ciclo 5 sería igual que el 1. */
const EV = Number(process.env.NEXT_PUBLIC_EV ?? 0.1);
const ED = Number(process.env.NEXT_PUBLIC_ED ?? 0.04);

export function escalaVida(state: State): number {
  return 1 + (state.ciclo - 1) * EV;
}
export function escalaDaño(state: State): number {
  return 1 + (state.ciclo - 1) * ED;
}

// --- interceptores --------------------------------------------------------

export function defectosActivos(state: State): Defecto[] {
  return state.jugador.defectos.map((id) => DEFECTOS[id]);
}

/**
 * Si ves lo que el enemigo va a hacer el turno que viene. Cuando no lo ves,
 * bloquear deja de ser una lectura y pasa a ser una apuesta.
 */
export function veElAviso(state: State): boolean {
  return !defectosActivos(state).some((d) => d.sinAviso);
}

export function puedeHuir(state: State): boolean {
  if (state.combate && ENEMIGOS[state.combate.enemigoId].profesor) return false;
  return !defectosActivos(state).some((d) => d.sinHuida);
}

/**
 * Contra un profesor los estados duran la mitad. Sus patrones son largos y
 * dos de ellos aplican dos tipos distintos: sin esto, una pelea de jefe te
 * deja con estados encima casi permanentemente y dejan de ser un momento
 * para pasar a ser el clima.
 */
function duracionEfecto(state: State): number {
  const base =
    DURACION_EFECTO + (defectosActivos(state).some((d) => d.efectosLargos) ? 1 : 0);
  const contraProfesor =
    state.combate && ENEMIGOS[state.combate.enemigoId].profesor;
  return contraProfesor ? Math.max(1, Math.round(base / 2)) : base;
}

export function tieneEfecto(state: State, e: Efecto): boolean {
  return state.efectos.some((x) => x.efecto === e);
}

export function confundido(state: State): boolean {
  return tieneEfecto(state, "confusion");
}

export function nombreDe(state: State, materiaId: string): string {
  return nombreMateria(materiaId, state.deformacion[materiaId] ?? 0);
}

// --- helpers --------------------------------------------------------------

function log(
  entradas: Entrada[],
  texto: string,
  tipo: Entrada["tipo"] = "neutral",
  actor?: Entrada["actor"],
  extra?: { icono?: Efecto; aviso?: boolean; tirada?: Entrada["tirada"] },
): Entrada[] {
  return [{ texto, tipo, actor, ...extra }, ...entradas].slice(0, 30);
}

/**
 * Igual que log(), pero deja anotado cómo quedaron las vidas justo después
 * del evento. Se llama SIEMPRE después de aplicar el cambio, para que la
 * barra baje en el mismo momento en que se lee el golpe.
 */
function logEstado(
  s: State,
  texto: string,
  tipo: Entrada["tipo"] = "neutral",
  actor?: Entrada["actor"],
  extra?: {
    icono?: Efecto;
    aviso?: boolean;
    tirada?: Entrada["tirada"];
    escudoUsado?: boolean;
  },
): Entrada[] {
  return [
    {
      texto,
      tipo,
      actor,
      ...extra,
      // Se recorta en cero: la vida puede quedar negativa por dentro para
      // decidir la muerte, pero eso es aritmética, no algo que se muestre.
      vidaJugador: Math.max(0, s.jugador.vida),
      vidaEnemigo: s.combate ? Math.max(0, s.combate.vida) : undefined,
      efectos: s.efectos,
      escudo: s.combate?.escudo,
    },
    ...s.log,
  ].slice(0, 30);
}

/** Le saca vida al enemigo dejando el estado listo para anotar el evento. */
function dañar(s: State, d: number): State {
  if (!s.combate) return s;
  const robo = s.combate.sangria
    ? Math.round(d * s.combate.sangria.robo)
    : 0;
  return {
    ...s,
    combate: { ...s.combate, vida: s.combate.vida - d },
    jugador: robo
      ? { ...s.jugador, vida: Math.min(s.jugador.vidaMax, s.jugador.vida + robo) }
      : s.jugador,
  };
}

/** Firma como del enemigo todo lo agregado desde `tope`. */
function firmar(s: State, tope: Entrada | undefined): Entrada[] {
  const corte = tope ? s.log.indexOf(tope) : s.log.length;
  return s.log.map((e, i) =>
    i < (corte === -1 ? s.log.length : corte) ? { ...e, actor: "eso" as const } : e,
  );
}

/**
 * Cuánto pega el jugador comparado con el arranque. Sube con cada profesor
 * vencido y multiplica TODO lo que hacés —puño, armas, items, contraataque—
 * para que la proporción entre ellos no se mueva mientras la escala crece.
 */
export function potencia(state: State): number {
  return 1 + state.profesoresVencidos * POR_PROFESOR;
}
const POR_PROFESOR = Number(process.env.NEXT_PUBLIC_POTENCIA ?? 0.4);

function aplicarDaño(state: State, base: number): number {
  let d = (base + (state.combate?.buff ?? 0)) * potencia(state);
  for (const def of defectosActivos(state)) if (def.daño) d = def.daño(d);
  return Math.max(1, Math.round(d));
}

function aplicarRecibido(state: State, base: number): number {
  let d = base;
  for (const def of defectosActivos(state)) if (def.recibido) d = def.recibido(d);
  return Math.max(1, Math.round(d));
}

function vidaMaxima(state: State, base: number): number {
  let v = base;
  for (const d of defectosActivos(state)) if (d.vidaMax) v = d.vidaMax(v);
  return v;
}

function nuevoPasillo(state: State, rng: Rng): Mundo {
  const menos = defectosActivos(state).some((d) => d.menosPuertas);
  return generarPasillo(rng, {
    cantidadPuertas: menos ? 3 : 5,
    deformacion: state.deformacion,
  });
}

function generarOferta(state: State, rng: Rng) {
  const poderesLibres = PODER_IDS.filter((p) => !state.jugador.poderes.includes(p));
  const defectosLibres = DEFECTO_IDS.filter(
    (d) => !state.jugador.defectos.includes(d),
  );
  const poderes = pickMany(rng, poderesLibres, 3);
  const defectos = pickMany(rng, defectosLibres, 3);
  return poderes.map((poderId, i) => ({
    poderId,
    defectoId: defectos[i] ?? defectosLibres[0] ?? DEFECTO_IDS[0],
  }));
}

/** Cada ciclo el colegio se corrompe un escalón más. */
function deformar(state: State, rng: Rng): State {
  const objetivos = pickMany(rng, MATERIA_IDS, 2);
  const deformacion = { ...state.deformacion };
  let l = state.log;
  for (const m of objetivos) {
    const antes = deformacion[m] ?? 0;
    if (antes >= 3) continue;
    deformacion[m] = antes + 1;
    if (antes + 1 >= 2) {
      l = log(
        l,
        `Donde decía ${nombreMateria(m, antes)} ahora dice ${nombreMateria(m, antes + 1)}.`,
        "sueño",
      );
    }
  }
  return { ...state, deformacion, log: l };
}

function despertar(state: State, rng: Rng): State {
  const ciclo = state.ciclo + 1;
  if (ciclo > CICLOS) {
    return {
      ...state,
      fase: "fin",
      mundo: null,
      final:
        "Saliste al patio y estaba amaneciendo de verdad. Dormiste catorce horas. Cuando te despertaste no te acordabas de nada, y eso fue lo peor.",
    };
  }
  const deformado = deformar({ ...state, ciclo }, rng);
  const base: State = {
    ...deformado,
    fase: "pasillo",
    oferta: [],
    efectos: [],
    log: log(deformado.log, "Te despertás. El pasillo es más largo.", "malo"),
  };
  return { ...base, mundo: nuevoPasillo(base, rng) };
}

// --- combate --------------------------------------------------------------

const TEXTO_EFECTO: Record<Efecto, string> = {
  confusion: "Dejás de entender lo que estás mirando.",
  miedo: "Se te va la mano al costado. No responde.",
  torpeza: "El cuerpo te llega tarde.",
};

/**
 * Un movimiento del enemigo. `cubierto` es el resultado de la tirada del
 * bloqueo, que se hace **una sola vez por turno** afuera de acá.
 *
 * Con torpeza el enemigo se mueve dos veces, y antes cada movimiento consultaba
 * `bloqueando` por su cuenta: el primero lo apagaba, así que el segundo entraba
 * siempre de lleno. Cubrirse tapaba la mitad del turno y no había forma de
 * saberlo — la pantalla muestra los dos avisos y un solo botón de BLOQUEAR.
 * Una tirada, un resultado, todo el turno.
 */
function turnoEnemigo(
  state: State,
  rng: Rng,
  cubierto: { salio: boolean; chance: number } | null,
): State {
  const c = state.combate;
  if (!c) return state;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  let s = state;
  /** Marca de agua: todo lo que se loguee de acá en más lo hizo el enemigo. */
  const tope = state.log[0];

  const acierta = random(rng) <= (intencion.precision ?? 0.85);
  const bloqueo = bloqueoDe(s);
  // Un golpe imparable atraviesa el bloqueo: cubrirse no sirve de nada.
  const bloqueaBien = !!cubierto && cubierto.salio && !intencion.imparable;
  /*
   * Cubrirse es la única acción del jugador que no se resuelve cuando la
   * apretás: el reloj gira recién cuando el golpe llega, que es donde está la
   * tensión. Contra un golpe imparable no hay tirada, y no tiene que haber
   * reloj: la pantalla ya dijo que no se puede bloquear.
   */
  const delBloqueo =
    cubierto && !intencion.imparable ? conTirada(cubierto.chance, cubierto.salio) : undefined;

  if (intencion.tipo === "golpe") {
    if (!acierta) {
      s = {
        ...s,
        log: logEstado(s, "Va hacia vos y pasa de largo.", "neutral", undefined, delBloqueo),
      };
    } else {
      // El impacto se cuenta primero y todavía no cuesta nada: el número, y
      // con él la barra, llegan en el evento siguiente.
      let daño = aplicarRecibido(s, (intencion.daño ?? 0) * MULT_ENEMIGO * escalaDaño(s));
      s = { ...s, log: logEstado(s, intencion.impacto ?? "Te alcanza.", "enemigo") };

      /*
       * El bloqueo se resuelve antes que el escudo. Al revés, un bloqueo que
       * salía bien te gastaba igual los anteojos en un golpe que no iba a
       * entrar: pagabas un único por nada.
       */
      if (bloqueaBien) daño = Math.round(daño * PASA_BLOQUEANDO);

      if (daño > 0 && s.combate!.escudo > 0) {
        daño = 0;
        s = { ...s, combate: { ...s.combate!, escudo: s.combate!.escudo - 1 } };
        s = {
          ...s,
          log: logEstado(s, "Lo viste llegar y no te tocó.", "bueno", undefined, {
            escudoUsado: true,
          }),
        };
      } else {
        s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - daño } };
        /*
         * Un bloqueo que sale para el golpe entero, igual que para un estado.
         * Antes se redondeaba con `Math.max(1, …)` y te entraba 1 de daño: la
         * pantalla decía "lo bloqueás" y la barra bajaba igual.
         */
        if (bloqueaBien) {
          s = {
            ...s,
            log: logEstado(
              s,
              daño > 0 ? `Lo bloqueás. Sólo −${daño}.` : "Lo bloqueás. No te toca.",
              "bueno",
              undefined,
              delBloqueo,
            ),
          };
        } else if (cubierto) {
          s = {
            ...s,
            log: logEstado(
              s,
              intencion.imparable
                ? `Te cubrís y pasa igual. −${daño}.`
                : `No llegás a bloquearlo. −${daño}.`,
              "malo",
              undefined,
              delBloqueo,
            ),
          };
        } else {
          s = { ...s, log: logEstado(s, `De lleno. −${daño}.`, "malo") };
        }
      }
    }
    // Cubrirse bien devuelve siempre lo mismo: haya entrado el golpe, lo hayas
    // parado entero, o te haya errado. Es una sola tirada y un solo resultado.
    if (bloqueaBien) {
      const d = aplicarDaño(s, bloqueo.daño);
      s = dañar(s, d);
      s = { ...s, log: logEstado(s, `Y le devolvés ${d}.`, "bueno") };
    }
  } else if (intencion.tipo === "efecto" && intencion.efecto) {
    if (bloqueaBien) {
      /*
       * Cubrirse te protege de todo, pero sólo se devuelve lo que te tiraron:
       * no hay golpe que redirigir. Medido con la devolución también acá, el
       * pasivo se iba a 22% contra 51% del luchador y bloquear volvía a ser la
       * respuesta a todo.
       */
      s = {
        ...s,
        log: logEstado(s, "Lo bloqueás. No te llega a agarrar.", "bueno", undefined, delBloqueo),
      };
    } else if (!acierta) {
      s = { ...s, log: logEstado(s, "Lo intenta y no te agarra.", "neutral") };
    } else {
      const ef = intencion.efecto;
      const ya = s.efectos.some((x) => x.efecto === ef);
      s = {
        ...s,
        efectos: ya
          ? s.efectos.map((x) =>
              x.efecto === ef ? { ...x, turnos: duracionEfecto(s) + 1 } : x,
            )
          : [...s.efectos, { efecto: ef, turnos: duracionEfecto(s) + 1 }],
      };
      s = {
        ...s,
        log: logEstado(s, TEXTO_EFECTO[ef], "enemigo", undefined, { icono: ef, ...delBloqueo }),
      };
    }
  } else {
    // Un turno de espera igual es un turno: si no se muestra, el jugador ve
    // su acción y después el aviso, y parece que el enemigo se la saltó.
    s = { ...s, log: logEstado(s, "No hace nada. Todavía.", "neutral") };
  }

  return {
    ...s,
    log: firmar(s, tope),
    combate: { ...s.combate!, paso: c.paso + 1 },
  };
}

/**
 * El pasivo que te levanta la primera vez que bajás de la mitad. Se chequea
 * después de resolver el turno, así el jugador ve primero el golpe que lo
 * dejó ahí y recién después la red.
 */
function redDeSeguridad(s: State): State {
  const red = pasivos(s).red;
  if (!red || !s.combate || s.combate.redUsada) return s;
  if (s.jugador.vida <= 0 || s.jugador.vida > s.jugador.vidaMax / 2) return s;
  const vida = Math.min(s.jugador.vidaMax, s.jugador.vida + red);
  const conRed: State = {
    ...s,
    jugador: { ...s.jugador, vida },
    combate: { ...s.combate, redUsada: true },
  };
  return {
    ...conRed,
    log: logEstado(conRed, `Segundo aire. Recuperás ${red}.`, "bueno", "vos"),
  };
}

function cerrarTurno(state: State, rng: Rng): State {
  /**
   * La torpeza se cobra desde el turno siguiente al que te agarra, no en el
   * mismo. Si no, el enemigo te la aplica y acto seguido ejecuta la intención
   * que venía después — una que nunca se anunció — y aparece un estado de la
   * nada. Todo lo que te pasa tiene que haber estado avisado.
   */
  const yaTorpe = tieneEfecto(state, "torpeza");

  /*
   * La tirada del bloqueo se hace acá, una sola vez, y vale para todo lo que el
   * enemigo haga este turno. El miedo va adentro —no en una tirada aparte— así
   * que éste es el mismo número que muestra el botón y el mismo que gira en el
   * reloj.
   */
  const chance = punteria(state, bloqueoDe(state).precision);
  const cubierto = state.combate?.bloqueando
    ? { salio: random(rng) <= chance, chance }
    : null;

  let s = turnoEnemigo(state, rng, cubierto);
  /*
   * El segundo movimiento sólo existe si los dos siguen en pie. El
   * contraataque del bloqueo puede haber sido el golpe final, y un enemigo que
   * ya cayó no puede seguir moviéndose: se veía como matarlo y comerse un
   * golpe suyo después.
   */
  if (yaTorpe && s.jugador.vida > 0 && (s.combate?.vida ?? 0) > 0) {
    // Sigue siendo el turno del enemigo: va firmado como suyo para que la
    // pausa larga caiga antes de esta línea y no en el medio.
    s = {
      ...s,
      log: logEstado(s, "Todavía no terminaste de moverte.", "enemigo", "eso"),
    };
    s = turnoEnemigo(s, rng, cubierto);
  }
  // El turno terminó: te destapás, hayas bloqueado o no.
  if (s.combate?.bloqueando) s = { ...s, combate: { ...s.combate, bloqueando: false } };
  /*
   * La lata te cobra todos los turnos, salvo el turno en que ganaste: cobrarte
   * después de que el enemigo cayó puede matarte en una pelea que ya terminó.
   */
  if (s.combate?.sangria && s.jugador.vida > 0 && s.combate.vida > 0) {
    const costo = s.combate.sangria.porTurno;
    s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - costo } };
    s = { ...s, log: logEstado(s, `La lata te cobra ${costo}.`, "malo", "vos") };
  }

  s = {
    ...s,
    efectos: s.efectos.map((e) => ({ ...e, turnos: e.turnos - 1 })).filter((e) => e.turnos > 0),
  };
  s = redDeSeguridad(s);

  if (s.jugador.vida <= 0) {
    /*
     * Morir es un evento más y tiene que poder verse: sin esta línea la
     * secuencia terminaba en el golpe y la pantalla saltaba al final, así que
     * lo último que veías era tu propia acción y después la muerte, sin el
     * turno del enemigo en el medio.
     */
    const caido: State = { ...s, jugador: { ...s.jugador, vida: 0 } };
    return {
      ...caido,
      log: logEstado(caido, "Se te apaga todo.", "malo", "vos"),
      fase: "muerto",
      combate: null,
      mundo: null,
      final: "No sonó ningún timbre.",
    };
  }
  // El contraataque puede haber sido el golpe final.
  if (s.combate && s.combate.vida <= 0) return ganarCombate(s, rng);

  // Recién ahora el enemigo decide lo próximo, y lo muestra. Este beat es lo
  // único que el jugador necesita para elegir su turno, así que tiene que
  // existir como evento y no cambiar en silencio arriba de la pantalla.
  if (s.combate) {
    const e = ENEMIGOS[s.combate.enemigoId];
    const proxima = e.patron[s.combate.paso % e.patron.length];
    s = { ...s, log: logEstado(s, proxima.tell, "enemigo", "eso", { aviso: true }) };
  }
  return s;
}

function ganarCombate(state: State, rng: Rng): State {
  const c = state.combate!;
  const enemigo = ENEMIGOS[c.enemigoId];
  const materia = MATERIAS[c.materiaId];
  let jugador: Jugador = {
    ...state.jugador,
    sombras: [...state.jugador.sombras, enemigo.id],
  };
  /*
   * Todo lo que se loguea de la victoria lleva al enemigo en cero.
   *
   * Sin esto, estas entradas no traían foto de las vidas y la interfaz caía al
   * combate congelado, que es el del turno ANTERIOR al golpe que lo mató: la
   * barra bajaba a cero con el remate y volvía a subir con el botín. El enemigo
   * se veía revivir justo después de matarlo.
   */
  const caido = (entradas: Entrada[], texto: string, tipo: Entrada["tipo"]): Entrada[] =>
    [
      {
        texto,
        tipo,
        vidaJugador: Math.max(0, state.jugador.vida),
        vidaEnemigo: 0,
        efectos: state.efectos,
        escudo: state.combate?.escudo,
      },
      ...entradas,
    ].slice(0, 30);

  let l = caido(state.log, `${enemigo.nombre} deja de estar.`, "bueno");
  let armaOfrecida: string | null = null;
  // Lo que sacaste, listado uno por uno. La sombra siempre cae.
  const botin: State["botin"] = [{ tipo: "sombra", id: enemigo.id, cantidad: 1 }];

  if (enemigo.profesor) {
    // Vencer a un profesor es la única progresión permanente que hay.
    const nuevaMax = vidaMaxima(state, state.jugador.vidaMax + 6);
    jugador = { ...jugador, vidaMax: nuevaMax, vida: nuevaMax };
    botin.push({ tipo: "vida", id: "vidaMax", cantidad: 6 });
    botin.push({ tipo: "potencia", id: "potencia", cantidad: Math.round(POR_PROFESOR * 100) });
    l = caido(l, "Aguantás más y pegás más fuerte que antes.", "bueno");
  } else if (materia && random(rng) < 0.45) {
    const armaId = pick(rng, materia.armas);
    const arma = ARMAS[armaId];
    const cuenta = arma.infinita ? "no se gasta" : `${arma.usos} usos por pelea`;
    if (jugador.armas.includes(armaId)) {
      // Ya la tenías: no hay nada que elegir.
      l = caido(l, `Otra ${arma.nombre}. Dejás la que estaba.`, "neutral");
    } else if (jugador.armas.length < MAX_ARMAS) {
      jugador = { ...jugador, armas: [...jugador.armas, armaId] };
      botin.push({ tipo: "arma", id: armaId, cantidad: 1 });
      l = caido(l, `Agarrás ${arma.nombre}. ${cuenta}.`, "bueno");
    } else {
      // Mochila llena: la decisión de qué dejar es del jugador.
      armaOfrecida = armaId;
      l = caido(l, `Hay ${arma.nombre}. ${cuenta}. No te entra nada más.`, "neutral");
    }
  } else if (jugador.items.length < 6) {
    // Cada materia da siempre lo suyo: por eso se puede aprender qué esperar.
    const cuantos = random(rng) < 0.25 ? 2 : 1;
    const candidatos = materia?.items ?? ITEM_IDS;
    const itemId = pickWeighted(
      rng,
      candidatos.map((id) => ({ item: id, weight: PESO_RAREZA[ITEMS[id].rareza] })),
    );
    const caben = Math.min(cuantos, 6 - jugador.items.length);
    jugador = { ...jugador, items: [...jugador.items, ...Array(caben).fill(itemId)] };
    botin.push({ tipo: "item", id: itemId, cantidad: caben });
    l = caido(l, `Guardás ${ITEMS[itemId].nombre}.`, "bueno");
  }

  return {
    ...state,
    jugador,
    combate: null,
    efectos: [],
    fase: "recompensa",
    cicloTerminado: !!enemigo.profesor,
    caido: { enemigoId: enemigo.id, materiaId: c.materiaId },
    profesoresVencidos: state.profesoresVencidos + (enemigo.profesor ? 1 : 0),
    armaOfrecida,
    botin,
    log: l,
  };
}

// --- estado inicial -------------------------------------------------------

export function initialState(seed: number = randomSeed()): State {
  const rng = makeRng(seed);
  const jugador: Jugador = {
    vida: VIDA_BASE,
    vidaMax: VIDA_BASE,
    armas: [],
    items: ["agua"],
    sombras: [],
    poderes: [],
    defectos: [],
  };
  const base: State = {
    seed,
    ciclo: 1,
    fase: "pasillo",
    jugador,
    mundo: null,
    combate: null,
    minijuego: null,
    materiaActual: null,
    efectos: [],
    deformacion: Object.fromEntries(MATERIA_IDS.map((m) => [m, 0])),
    cicloTerminado: false,
    caido: null,
    profesoresVencidos: 0,
    oferta: [],
    armaOfrecida: null,
    botin: [],
    log: [{ texto: "Hace tres días que no dormís bien. Sonó el timbre.", tipo: "neutral" }],
    final: null,
  };
  return { ...base, mundo: nuevoPasillo(base, rng), seed: rng.seed };
}

// --- reducer --------------------------------------------------------------

export function reduce(state: State, action: Action): State {
  if (action.type === "reiniciar") return initialState(action.seed);
  const rng = makeRng(state.seed);
  const next = apply(state, action, rng);
  return { ...next, seed: rng.seed };
}

function apply(state: State, action: Action, rng: Rng): State {
  switch (action.type) {
    case "entrar-aula": {
      if (state.fase !== "pasillo" || !state.mundo) return state;
      const puerta = state.mundo.puertas.find(
        (p) => p.x === action.puertaX && p.y === action.puertaY,
      );
      if (!puerta || puerta.usada) return state;
      const enemigo = ENEMIGOS[puerta.enemigoId];
      const vidaEnemigo = Math.round(enemigo.vida * escalaVida(state));

      const mundo: Mundo = {
        ...state.mundo,
        puertas: state.mundo.puertas.map((p) =>
          p === puerta ? { ...p, usada: true } : p,
        ),
      };

      // Una bendición no cuesta nada y por eso da menos: un solo item común.
      if (puerta.sorteado === "bendicion") {
        const itemId = premioDe(rng, puerta.materiaId, 1, true)[0];
        const cabe = state.jugador.items.length < 6 && !!itemId;
        return {
          ...state,
          fase: "recompensa",
          mundo,
          materiaActual: puerta.materiaId,
          caido: null,
          cicloTerminado: false,
          // El botín es lo que se muestra; si no se guarda acá, no se guarda.
          jugador: cabe
            ? { ...state.jugador, items: [...state.jugador.items, itemId] }
            : state.jugador,
          botin: cabe ? [{ tipo: "item", id: itemId, cantidad: 1 }] : [],
          log: log(
            state.log,
            cabe
              ? `${nombreDe(state, puerta.materiaId)}. No hay nadie. Encontrás algo.`
              : `${nombreDe(state, puerta.materiaId)}. No hay nadie, y no te entra nada más.`,
            "bueno",
          ),
        };
      }

      if (puerta.sorteado === "juego") {
        const mini = armarMinijuego(rng, state.jugador.sombras);
        return {
          ...state,
          fase: "juego",
          mundo,
          minijuego: mini,
          materiaActual: puerta.materiaId,
          log: log(
            state.log,
            `${nombreDe(state, puerta.materiaId)}. No hay nadie. ${mini.cuento}`,
            "neutral",
          ),
        };
      }

      return {
        ...state,
        fase: "combate",
        mundo,
        materiaActual: puerta.materiaId,
        efectos: [],
        // Entrás entero: cada combate es un desafío letal autocontenido, no
        // una carrera de desgaste por el pasillo.
        jugador: { ...state.jugador, vida: state.jugador.vidaMax },
        combate: {
          enemigoId: enemigo.id,
          materiaId: puerta.materiaId,
          vida: vidaEnemigo,
          vidaMax: vidaEnemigo,
          paso: 0,
          bloqueando: false,
          // Los usos de armas y poderes vuelven enteros en cada aula.
          armasUsadas: {},
          poderesUsados: {},
          primerGolpeHecho: false,
          redUsada: false,
          buff: 0,
          escudo: 0,
          sangria: null,
        },
        // Entrás, y lo primero que pasa es que ves qué va a hacer.
        log: log(
          log(
            state.log,
            enemigo.profesor
              ? `Adentro está ${enemigo.nombre}. La puerta no abre para atrás.`
              : `${nombreDe(state, puerta.materiaId)}. Hay ${enemigo.nombre}.`,
            enemigo.profesor ? "malo" : "neutral",
          ),
          enemigo.patron[0].tell,
          "enemigo",
          "eso",
          { aviso: true },
        ),
      };
    }

    case "juego": {
      if (state.fase !== "juego" || !state.minijuego) return state;
      const j = jugar(state.minijuego, action.eleccion, rng);
      if (!j.terminado) {
        return { ...state, minijuego: j, log: log(state.log, j.cuento) };
      }
      // Terminado: el premio sale de la materia del aula, como cualquier botín.
      const gana = premioDe(rng, state.materiaActual ?? "", j.premio);
      const caben = gana.slice(0, Math.max(0, 6 - state.jugador.items.length));
      return {
        ...state,
        fase: "recompensa",
        minijuego: null,
        caido: null,
        cicloTerminado: false,
        jugador: { ...state.jugador, items: [...state.jugador.items, ...caben] },
        botin: agruparBotin(caben),
        log: log(state.log, j.cuento, j.premio > 0 ? "bueno" : "malo"),
      };
    }

    case "combate":
      return turnoDeCombate(state, action.accion, action.ref, rng);

    case "canjear-arma": {
      if (state.fase !== "recompensa" || !state.armaOfrecida) return state;
      const nueva = state.armaOfrecida;
      if (!action.dejar) {
        return {
          ...state,
          armaOfrecida: null,
          log: log(state.log, `Dejás ${ARMAS[nueva].nombre} donde estaba.`, "neutral"),
        };
      }
      if (!state.jugador.armas.includes(action.dejar)) return state;
      return {
        ...state,
        armaOfrecida: null,
        jugador: {
          ...state.jugador,
          armas: state.jugador.armas.map((a) => (a === action.dejar ? nueva : a)),
        },
        log: log(
          state.log,
          `Soltás ${ARMAS[action.dejar].nombre} y te llevás ${ARMAS[nueva].nombre}.`,
          "bueno",
        ),
      };
    }

    case "seguir": {
      if (state.fase !== "recompensa") return state;
      // No se sale del aula con un arma en la mano sin decidir.
      if (state.armaOfrecida) return state;
      // Si lo que cayó era un profesor, se termina el ciclo y se duerme.
      return volverAlPasillo(state, rng, state.cicloTerminado);
    }

    case "aceptar-oferta": {
      if (state.fase !== "sueño") return state;
      const par = state.oferta[action.index];
      if (!par) return state;
      const poder = PODERES[par.poderId];
      const defecto = DEFECTOS[par.defectoId];
      const jugador: Jugador = {
        ...state.jugador,
        poderes: [...state.jugador.poderes, poder.id],
        defectos: [...state.jugador.defectos, defecto.id],
      };
      const aceptado: State = {
        ...state,
        jugador,
        log: log(
          log(state.log, `${poder.nombre}. ${poder.texto}`, "sueño"),
          `El precio: ${defecto.nombre}. ${defecto.texto}`, "malo",
        ),
      };
      return despertar(aceptado, rng);
    }

    default:
      return state;
  }
}

/** Junta repetidos para listarlos con su cantidad. */
function agruparBotin(ids: string[]): State["botin"] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].map(([id, cantidad]) => ({
    tipo: "item" as const,
    id,
    cantidad,
  }));
}

function volverAlPasillo(state: State, rng: Rng, forzarSueño: boolean): State {
  if (forzarSueño) {
    return {
      ...state,
      fase: "sueño",
      mundo: null,
      cicloTerminado: false,
      caido: null,
      oferta: generarOferta(state, rng),
      log: log(state.log, "Te sentás en el pasillo y por fin te dormís.", "sueño"),
    };
  }
  return { ...state, fase: "pasillo", caido: null };
}

/**
 * La salida común de USAR: item, sombra o poder, ninguno gasta el turno.
 *
 * Antes sólo los items eran gratis y la sombra —cuya única función es sacarte
 * los estados de encima— te cobraba el turno del enemigo. Los tres viven en el
 * mismo menú y se ven igual, así que el jugador aprendía la regla con uno y la
 * desaprendía con el otro: limpiabas la confusión y te comías un golpe por
 * haberla limpiado.
 *
 * Se conserva el `bloqueando` con el que entraste: usar algo no te descubre.
 */
function salirDeUsar(s: State, c: Combate, rng: Rng): State {
  if (s.combate!.vida <= 0) return ganarCombate(s, rng);
  return { ...s, combate: { ...s.combate!, bloqueando: c.bloqueando } };
}

function turnoDeCombate(
  state: State,
  accion: Accion,
  ref: string | undefined,
  rng: Rng,
): State {
  if (state.fase !== "combate" || !state.combate) return state;
  const c = state.combate;
  let s = state;

  if (accion === "huir") {
    if (!puedeHuir(s)) return s;
    return {
      ...s,
      fase: "pasillo",
      combate: null,
      efectos: [],
      log: log(s.log, "Salís al pasillo. No mirás atrás.", "neutral"),
    };
  }

  let bloqueando = false;

  switch (accion) {
    case "atacar": {
      const punto = punteria(s, PRECISION_ATAQUE);
      if (random(rng) > punto) {
        s = {
          ...s,
          log: logEstado(
            s,
            tieneEfecto(s, "miedo")
              ? "No te sale. Te quedás duro."
              : "Tirás el brazo y no está donde creías.",
            "malo",
            undefined,
            conTirada(punto, false),
          ),
        };
        break;
      }
      const doble = pasivos(s).primerGolpeDoble && !s.combate!.primerGolpeHecho;
      const d = aplicarDaño(s, doble ? DAÑO_ATAQUE * 2 : DAÑO_ATAQUE);
      s = dañar(s, d);
      s = { ...s, combate: { ...s.combate!, primerGolpeHecho: true } };
      s = {
        ...s,
        log: logEstado(
          s,
          doble ? `El primero entra entero. ${d}.` : `Le pegás. ${d}.`,
          doble ? "bueno" : "neutral",
          undefined,
          conTirada(punto, true),
        ),
      };
      break;
    }
    case "bloquear": {
      bloqueando = true;
      s = { ...s, log: logEstado(s, "Te cubrís y esperás.", "neutral") };
      break;
    }
    case "arma": {
      const armaId = ref ?? s.jugador.armas[0];
      if (!armaId || !s.jugador.armas.includes(armaId)) return s;
      if (usosArma(s, armaId) <= 0) return s;
      const arma = ARMAS[armaId];
      /*
       * La precisión se lee antes de gastar el uso: el desgaste corre de este
       * golpe en adelante, así que la chance que se muestra en el reloj es la
       * misma que decía el botón cuando lo apretaste.
       */
      const punto = punteria(s, precisionArma(s, armaId));
      // El uso se gasta aciertes o no. Y se recupera al salir del aula.
      const acierta = random(rng) <= punto;
      const critico = acierta && random(rng) <= arma.critico;

      const dobleArma = pasivos(s).primerGolpeDoble && !s.combate!.primerGolpeHecho;
      s = {
        ...s,
        combate: {
          ...s.combate!,
          primerGolpeHecho: true,
          armasUsadas: {
            ...s.combate!.armasUsadas,
            [armaId]: (s.combate!.armasUsadas[armaId] ?? 0) + 1,
          },
        },
      };

      if (!acierta) {
        // Errar es errar: no se tira la pérdida porque no hubo golpe.
        s = {
          ...s,
          log: logEstado(
            s,
            tieneEfecto(s, "miedo")
              ? `No te sale. ${arma.nombre} se te queda en la mano.`
              : `${arma.nombre} pasa al lado.`,
            "malo",
            undefined,
            conTirada(punto, false),
          ),
        };
      } else {
        const mult = (critico ? 2 : 1) * (dobleArma ? 2 : 1);
        const d = aplicarDaño(s, arma.daño * mult);
        s = dañar(s, d);
        s = {
          ...s,
          log: logEstado(
            s,
            critico ? `${arma.texto} Justo ahí. ${d}.` : `${arma.texto} ${d}.`,
            "bueno",
            undefined,
            conTirada(punto, true),
          ),
        };
        // Recién ahora, y sólo porque entró, puede perderse en el rebote.
        if (arma.perdida && random(rng) <= arma.perdida) {
          s = {
            ...s,
            jugador: {
              ...s.jugador,
              armas: s.jugador.armas.filter((a) => a !== armaId),
            },
          };
          s = {
            ...s,
            log: logEstado(s, `${arma.nombre} rebota mal y no vuelve.`, "malo"),
          };
        }
      }
      break;
    }
    case "usar": {
      if (!ref) return s;

      // Las sombras se gastan de verdad: son trofeos, no munición.
      if (ref.startsWith("sombra:")) {
        const id = ref.slice(7);
        const i = s.jugador.sombras.indexOf(id);
        if (i === -1) return s;
        s = {
          ...s,
          jugador: {
            ...s.jugador,
            sombras: s.jugador.sombras.filter((_, k) => k !== i),
          },
          efectos: [],
        };
        s = {
          ...s,
          log: logEstado(s, `La sombra de ${ENEMIGOS[id].nombre} se interpone.`, "bueno"),
        };
        return salirDeUsar(s, c, rng);
      }

      if (ref.startsWith("poder:")) {
        const id = ref.slice(6);
        if (!s.jugador.poderes.includes(id) || usosPoder(s, id) <= 0) return s;
        const poder = PODERES[id];
        if (poder.pasivo) return s;
        // El uso se gasta salga o no; vuelve entero en el próximo combate.
        s = {
          ...s,
          combate: {
            ...s.combate!,
            poderesUsados: {
              ...s.combate!.poderesUsados,
              [id]: (s.combate!.poderesUsados[id] ?? 0) + 1,
            },
          },
        };
        const punto = punteria(s, poder.precision);
        if (random(rng) > punto) {
          s = {
            ...s,
            log: logEstado(
              s,
              `${poder.nombre} no llega a agarrar.`,
              "malo",
              undefined,
              conTirada(punto, false),
            ),
          };
          return salirDeUsar(s, c, rng);
        }
        if (poder.efecto.daño) s = dañar(s, aplicarDaño(s, poder.efecto.daño));
        if (poder.efecto.vida) {
          s = {
            ...s,
            jugador: {
              ...s.jugador,
              vida: Math.min(s.jugador.vidaMax, s.jugador.vida + poder.efecto.vida),
            },
          };
        }
        if (poder.efecto.limpia) s = { ...s, efectos: [] };
        s = {
          ...s,
          log: logEstado(s, `${poder.nombre}.`, "sueño", undefined, conTirada(punto, true)),
        };
        return salirDeUsar(s, c, rng);
      }

      const idx = s.jugador.items.indexOf(ref);
      if (idx === -1) return s;
      const item = ITEMS[ref];
      s = {
        ...s,
        jugador: { ...s.jugador, items: s.jugador.items.filter((_, k) => k !== idx) },
      };
      const punto = punteria(s, item.precision);
      if (random(rng) > punto) {
        s = {
          ...s,
          log: logEstado(
            s,
            `${item.nombre} se te escapa de la mano.`,
            "malo",
            undefined,
            conTirada(punto, false),
          ),
        };
        return salirDeUsar(s, c, rng);
      }
      if (item.efecto.vida) {
        s = {
          ...s,
          jugador: {
            ...s.jugador,
            vida: Math.min(s.jugador.vidaMax, s.jugador.vida + item.efecto.vida),
          },
        };
      }
      if (item.efecto.daño) s = dañar(s, aplicarDaño(s, item.efecto.daño));
      if (item.efecto.limpia) s = { ...s, efectos: [] };
      if (item.efecto.buff) {
        s = { ...s, combate: { ...s.combate!, buff: s.combate!.buff + item.efecto.buff } };
      }
      if (item.efecto.escudo) {
        s = { ...s, combate: { ...s.combate!, escudo: s.combate!.escudo + 1 } };
      }
      if (item.efecto.sangria) {
        s = { ...s, combate: { ...s.combate!, sangria: item.efecto.sangria } };
      }
      s = {
        ...s,
        log: logEstado(s, `Usás ${item.nombre}.`, "bueno", undefined, conTirada(punto, true)),
      };
      return salirDeUsar(s, c, rng);
    }
  }

  s = { ...s, combate: { ...s.combate!, bloqueando } };
  if (s.combate!.vida <= 0) return ganarCombate(s, rng);
  return cerrarTurno(s, rng);
}
