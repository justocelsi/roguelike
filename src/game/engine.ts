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

import { ARMAS, ENEMIGOS, ITEMS, ITEM_IDS, MATERIAS, MATERIA_IDS, nombreMateria } from "./content";
import { generarPasillo, type Mundo } from "./mundo";
import { DEFECTOS, DEFECTO_IDS, PODERES, PODER_IDS } from "./poderes";
import { makeRng, pick, pickMany, random, randomSeed, type Rng } from "./rng";
import type {
  Accion,
  Action,
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
export const DAÑO_CONTRA = 15;

/**
 * Nada acierta siempre, de ningún lado. La regla que mantiene esto justo es
 * que el número esté siempre a la vista: el azar escondido se siente tramposo,
 * el azar declarado es una apuesta que tomó el jugador.
 *
 * Las dos acciones que premian leer bien el aviso son las que mejor apuntan.
 */
export const PRECISION_ATAQUE = 0.92;
export const PRECISION_CONTRA = 0.9;
/** Ningún arma baja de acá por más gastada que esté. */
const PRECISION_MINIMA = 0.35;

/** Con miedo encima, esta parte de las acciones no sale directamente. */
export const FALLA_POR_MIEDO = 0.3;

/**
 * El miedo se multiplica con la precisión de lo que uses: primero tira si la
 * acción sale, después si acierta. La interfaz muestra el producto, no los
 * factores, porque es lo que al jugador le importa.
 */
export function factorMiedo(state: State): number {
  return tieneEfecto(state, "miedo") ? 1 - FALLA_POR_MIEDO : 1;
}

/** Cuántas armas entran en la mochila. Llenarla obliga a elegir. */
export const MAX_ARMAS = 3;

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

export function puedeHuir(state: State): boolean {
  if (state.combate && ENEMIGOS[state.combate.enemigoId].profesor) return false;
  return !defectosActivos(state).some((d) => d.sinHuida);
}

function duracionEfecto(state: State): number {
  return (
    DURACION_EFECTO + (defectosActivos(state).some((d) => d.efectosLargos) ? 1 : 0)
  );
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
  extra?: { icono?: Efecto; aviso?: boolean },
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
  extra?: { icono?: Efecto; aviso?: boolean },
): Entrada[] {
  return [
    {
      texto,
      tipo,
      actor,
      ...extra,
      vidaJugador: s.jugador.vida,
      vidaEnemigo: s.combate?.vida,
    },
    ...s.log,
  ].slice(0, 30);
}

/** Le saca vida al enemigo dejando el estado listo para anotar el evento. */
function dañar(s: State, d: number): State {
  if (!s.combate) return s;
  return { ...s, combate: { ...s.combate, vida: s.combate.vida - d } };
}

function aplicarDaño(state: State, base: number): number {
  let d = base;
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

function turnoEnemigo(state: State, rng: Rng): State {
  const c = state.combate;
  if (!c) return state;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  let s = state;
  /** Marca de agua: todo lo que se loguee de acá en más lo hizo el enemigo. */
  const tope = state.log[0];

  const acierta = random(rng) <= (intencion.precision ?? 0.85);
  /** Te cubriste: aunque no te toque, quedaste parado para devolver. */
  const devolver = () => {
    if (!c.esperando) return;
    const d = aplicarDaño(s, DAÑO_CONTRA);
    if (random(rng) > PRECISION_CONTRA) {
      s = { ...s, log: logEstado(s, "Tirás a devolver y no llegás.", "neutral") };
    } else {
      s = dañar(s, d);
      s = { ...s, log: logEstado(s, `Se abrió. Le devolvés ${d}.`, "bueno") };
    }
  };

  if (intencion.tipo === "golpe") {
    if (!acierta) {
      s = { ...s, log: logEstado(s, "Va hacia vos y pasa de largo.", "neutral") };
      devolver();
    } else {
      // El impacto se cuenta primero y todavía no cuesta nada: el número, y
      // con él la barra, llegan en el evento siguiente.
      let daño = aplicarRecibido(s, (intencion.daño ?? 0) * escalaDaño(s));
      s = { ...s, log: logEstado(s, intencion.impacto ?? "Te alcanza.", "enemigo") };
      if (c.esperando) daño = Math.max(1, Math.round(daño * 0.2));
      s = { ...s, jugador: { ...s.jugador, vida: s.jugador.vida - daño } };
      s = {
        ...s,
        log: c.esperando
          ? logEstado(s, `Lo viste venir: sólo −${daño}.`, "bueno")
          : logEstado(s, `De lleno. −${daño}.`, "malo"),
      };
      if (c.esperando) devolver();
    }
  } else if (intencion.tipo === "efecto" && intencion.efecto) {
    if (!acierta) {
      s = { ...s, log: logEstado(s, "Lo intenta y no te agarra.", "neutral") };
    } else {
      const ef = intencion.efecto;
      const ya = s.efectos.some((x) => x.efecto === ef);
      s = {
        ...s,
        efectos: ya
          ? s.efectos.map((x) => (x.efecto === ef ? { ...x, turnos: duracionEfecto(s) } : x))
          : [...s.efectos, { efecto: ef, turnos: duracionEfecto(s) }],
      };
      s = { ...s, log: logEstado(s, TEXTO_EFECTO[ef], "enemigo", undefined, { icono: ef }) };
    }
  } else {
    // Un turno de espera igual es un turno: si no se muestra, el jugador ve
    // su acción y después el aviso, y parece que el enemigo se la saltó.
    s = { ...s, log: logEstado(s, "No hace nada. Todavía.", "neutral") };
  }

  // Todo lo agregado en este turno lleva la firma del enemigo.
  const corte = tope ? s.log.indexOf(tope) : s.log.length;
  const firmado = s.log.map((e, i) =>
    i < (corte === -1 ? s.log.length : corte) ? { ...e, actor: "eso" as const } : e,
  );

  return {
    ...s,
    log: firmado,
    combate: { ...s.combate!, paso: c.paso + 1, esperando: false },
  };
}

function cerrarTurno(state: State, rng: Rng): State {
  let s = turnoEnemigo(state, rng);
  if (tieneEfecto(s, "torpeza") && s.jugador.vida > 0) {
    // Sigue siendo el turno del enemigo: va firmado como suyo para que la
    // pausa larga caiga antes de esta línea y no en el medio.
    s = {
      ...s,
      log: logEstado(s, "Todavía no terminaste de moverte.", "enemigo", "eso"),
    };
    s = turnoEnemigo(s, rng);
  }
  s = {
    ...s,
    efectos: s.efectos.map((e) => ({ ...e, turnos: e.turnos - 1 })).filter((e) => e.turnos > 0),
  };

  if (s.jugador.vida <= 0) {
    return {
      ...s,
      jugador: { ...s.jugador, vida: 0 },
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
    s = { ...s, log: log(s.log, proxima.tell, "enemigo", "eso", { aviso: true }) };
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
  let l = log(state.log, `${enemigo.nombre} deja de estar.`, "bueno");
  let armaOfrecida: string | null = null;

  if (enemigo.profesor) {
    // Vencer a un profesor es la única progresión permanente que hay.
    const nuevaMax = vidaMaxima(state, state.jugador.vidaMax + 6);
    jugador = { ...jugador, vidaMax: nuevaMax, vida: nuevaMax };
    l = log(l, "Aguantás un poco más que antes. +6 de vida máxima.", "bueno");
  } else if (materia && random(rng) < 0.45) {
    const armaId = pick(rng, materia.armas);
    const arma = ARMAS[armaId];
    const cuenta = arma.infinita ? "no se gasta" : `${arma.usos} usos por pelea`;
    if (jugador.armas.includes(armaId)) {
      // Ya la tenías: no hay nada que elegir.
      l = log(l, `Otra ${arma.nombre}. Dejás la que estaba.`, "neutral");
    } else if (jugador.armas.length < MAX_ARMAS) {
      jugador = { ...jugador, armas: [...jugador.armas, armaId] };
      l = log(l, `Agarrás ${arma.nombre}. ${cuenta}.`, "bueno");
    } else {
      // Mochila llena: la decisión de qué dejar es del jugador.
      armaOfrecida = armaId;
      l = log(l, `Hay ${arma.nombre}. ${cuenta}. No te entra nada más.`, "neutral");
    }
  } else if (jugador.items.length < 6) {
    const itemId = pick(rng, ITEM_IDS);
    jugador = { ...jugador, items: [...jugador.items, itemId] };
    l = log(l, `Guardás ${ITEMS[itemId].nombre}.`, "bueno");
  }

  return {
    ...state,
    jugador,
    combate: null,
    efectos: [],
    fase: "recompensa",
    cicloTerminado: !!enemigo.profesor,
    armaOfrecida,
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
    efectos: [],
    deformacion: Object.fromEntries(MATERIA_IDS.map((m) => [m, 0])),
    cicloTerminado: false,
    oferta: [],
    armaOfrecida: null,
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
      const enemigo = ENEMIGOS[puerta.sorteado];
      const vidaEnemigo = Math.round(enemigo.vida * escalaVida(state));

      const mundo: Mundo = {
        ...state.mundo,
        puertas: state.mundo.puertas.map((p) =>
          p === puerta ? { ...p, usada: true } : p,
        ),
      };

      return {
        ...state,
        fase: "combate",
        mundo,
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
          esperando: false,
          // Los usos de armas y poderes vuelven enteros en cada aula.
          armasUsadas: {},
          poderesUsados: {},
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

function volverAlPasillo(state: State, rng: Rng, forzarSueño: boolean): State {
  if (forzarSueño) {
    return {
      ...state,
      fase: "sueño",
      mundo: null,
      cicloTerminado: false,
      oferta: generarOferta(state, rng),
      log: log(state.log, "Te sentás en el pasillo y por fin te dormís.", "sueño"),
    };
  }
  return { ...state, fase: "pasillo" };
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

  // El miedo puede hacer que la acción no salga.
  if (tieneEfecto(s, "miedo") && random(rng) < FALLA_POR_MIEDO) {
    s = { ...s, log: log(s.log, "No te sale. Te quedás duro.", "malo") };
    return cerrarTurno(s, rng);
  }

  let esperando = false;

  switch (accion) {
    case "atacar": {
      if (random(rng) > PRECISION_ATAQUE) {
        s = { ...s, log: logEstado(s, "Tirás el brazo y no está donde creías.", "malo") };
        break;
      }
      const d = aplicarDaño(s, DAÑO_ATAQUE);
      s = dañar(s, d);
      s = { ...s, log: logEstado(s, `Le pegás. ${d}.`, "neutral") };
      break;
    }
    case "esperar": {
      esperando = true;
      s = { ...s, log: logEstado(s, "Te cubrís y esperás.", "neutral") };
      break;
    }
    case "arma": {
      const armaId = ref ?? s.jugador.armas[0];
      if (!armaId || !s.jugador.armas.includes(armaId)) return s;
      if (usosArma(s, armaId) <= 0) return s;
      const arma = ARMAS[armaId];
      // El uso se gasta aciertes o no. Y se recupera al salir del aula.
      const acierta = random(rng) <= precisionArma(s, armaId);
      const critico = acierta && random(rng) <= arma.critico;

      s = {
        ...s,
        combate: {
          ...s.combate!,
          armasUsadas: {
            ...s.combate!.armasUsadas,
            [armaId]: (s.combate!.armasUsadas[armaId] ?? 0) + 1,
          },
        },
      };

      if (!acierta) {
        s = { ...s, log: logEstado(s, `${arma.nombre} pasa al lado.`, "malo") };
      } else {
        const d = aplicarDaño(s, critico ? arma.daño * 2 : arma.daño);
        s = dañar(s, d);
        s = {
          ...s,
          log: logEstado(
            s,
            critico ? `${arma.texto} Justo ahí. ${d}.` : `${arma.texto} ${d}.`,
            "bueno",
          ),
        };
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
        break;
      }

      if (ref.startsWith("poder:")) {
        const id = ref.slice(6);
        if (!s.jugador.poderes.includes(id) || usosPoder(s, id) <= 0) return s;
        const poder = PODERES[id];
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
        if (random(rng) > poder.precision) {
          s = { ...s, log: logEstado(s, `${poder.nombre} no llega a agarrar.`, "malo") };
          break;
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
        s = { ...s, log: logEstado(s, `${poder.nombre}.`, "sueño") };
        break;
      }

      // Los items se consumen para siempre: guardarlos o quemarlos ahora es
      // media estrategia del juego.
      const idx = s.jugador.items.indexOf(ref);
      if (idx === -1) return s;
      const item = ITEMS[ref];
      s = {
        ...s,
        jugador: { ...s.jugador, items: s.jugador.items.filter((_, k) => k !== idx) },
      };
      if (random(rng) > item.precision) {
        s = { ...s, log: logEstado(s, `${item.nombre} se te escapa de la mano.`, "malo") };
        break;
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
      s = { ...s, log: logEstado(s, `Usás ${item.nombre}.`, "bueno") };
      break;
    }
  }

  s = { ...s, combate: { ...s.combate!, esperando } };
  if (s.combate!.vida <= 0) return ganarCombate(s, rng);
  return cerrarTurno(s, rng);
}
