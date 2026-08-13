"use client";

import { useEffect, useRef, useState } from "react";
import { ARMAS, ENEMIGOS, EXPLICACION_EFECTO, ITEMS, MATERIAS } from "@/game/content";
import {
  CICLOS,
  dañoDe,
  dañoRecibidoDe,
  punteriaArma,
  confundido,
  DAÑO_ATAQUE,
  bloqueoDe,
  armasUsables,
  punteria,
  avisos,
  veElAviso,
  initialState,
  MAX_ARMAS,
  TURNOS_RAPIDO,
  nombreDe,
  PRECISION_ATAQUE,
  puedeHuir,
  reduce,
  usosArma,
  usosPoder,
} from "@/game/engine";
import {
  CUERPO,
  PISO,
  PUERTA,
  SALA,
  TILE,
  VELOCIDAD,
  mover,
  puertaCerca,
  tileEn,
  type Mundo,
  type Puerta,
} from "@/game/mundo";
import { preguntaDe, type Minijuego } from "@/game/minijuegos";
import { DEFECTOS, PODERES } from "@/game/poderes";
import {
  alternarMudo,
  despertarSonido,
  estaMudo,
  sonar,
  ticsDeReloj,
} from "./sonido";
import {
  ICONOS,
  ICONOS_ACCION,
  ICONOS_EFECTO,
  ICONOS_ITEM,
  SPRITES,
} from "@/game/sprites";
import type { Accion, Action, Entrada, Intencion, State } from "@/game/types";

/**
 * La curva con la que frena la aguja del reloj. Vive acá porque la usan dos
 * cosas que tienen que estar sincronizadas: el CSS que mueve la aguja y el
 * cálculo de cuándo suena cada tic.
 */
const CURVA_AGUJA: [number, number, number, number] = [0.1, 0.72, 0.16, 1];

/**
 * El sonido de un evento del combate, deducido de lo que el evento ya dice.
 *
 * No hace falta que el motor mande un nombre de sonido: el evento trae la foto
 * de las vidas, así que la dirección del daño se sabe restando. Lo único que
 * necesita marca propia es el bloqueo, porque un bloqueo que sale no deja
 * rastro en ninguna vida.
 */
function sonidoDe(e: Entrada, previo: Entrada | null): Parameters<typeof sonar>[0] | null {
  if (e.escudoUsado) return "escudo";
  if (e.cura) return "recompone";
  if (e.icono) return "estado";
  if (e.bloqueo) return "bloqueo";

  const antesVos = previo?.vidaJugador;
  const antesEso = previo?.vidaEnemigo;
  if (e.vidaJugador !== undefined && antesVos !== undefined && e.vidaJugador < antesVos) {
    return "recibis";
  }
  if (e.vidaEnemigo !== undefined && antesEso !== undefined && e.vidaEnemigo < antesEso) {
    // Cuanto más fuerte el golpe, más grave suena. Se nota sin leer el número.
    return antesEso - e.vidaEnemigo >= 15 ? "arma" : "golpe";
  }
  if (e.tirada && !e.tirada.salio) return "fallo";
  if (/Guardás|Agarrás|deja de estar/.test(e.texto)) {
    return e.texto.includes("deja de estar") ? "muere" : "hallazgo";
  }
  return null;
}

/** Cuánto dura un evento común en pantalla. */
const RITMO = 780;
/** El último evento de una mano se queda más: es el turno cambiando de lado. */
const RITMO_TURNO = 1350;
/** El aviso del enemigo: es lo único que hay que leer para decidir. */
const RITMO_AVISO = 2000;
/**
 * Un evento que se resolvió con una tirada dura más: la aguja del reloj tiene
 * que llegar a frenar y el resultado tiene que llegar a leerse después.
 */
const RITMO_TIRADA = 1750;
/** Y el escudo rompiéndose: medio segundo entero, y después cae. */
const RITMO_ESCUDO = 1900;

/*
 * Los beats del umbral: la puerta, la luz subiendo, y lo que hay adentro
 * tomando forma. El aula vacía tiene un beat más —el objeto aparece después de
 * que ya viste que no hay nadie— y por eso hasta ese momento las tres clases de
 * aula tienen que verse exactamente igual.
 *
 * El primero es corto a propósito: la oscuridad no cuenta nada, sólo separa. Lo
 * que hay que dejar respirar es la luz subiendo y la figura tomando forma.
 */
const BEATS_UMBRAL = [420, 1350, 1400];
const BEAT_PREMIO = 1700;

/**
 * Nada que tapó la pantalla se va de golpe.
 *
 * Es la regla que evita lo áspero: si algo entró despacio y sale en un frame,
 * el corte se siente aunque lo de atrás sea correcto. Todo lo que cubre —el
 * umbral, la historia de la entrada— se apaga con este fundido antes de
 * desmontarse.
 */
const FUNDIDO = 620;

const SIN_LOG: Entrada[] = [];

/**
 * El porcentaje que se muestra de cualquier cosa que hagas vos. **Uno solo para
 * toda la interfaz.**
 *
 * Había dos versiones: la del combate, que descontaba el miedo, y la del
 * inventario, que mostraba el número de fábrica. Como el inventario se abre en
 * pleno combate, con miedo encima el botón decía 70% y la ficha del mismo item
 * decía 90%.
 */
/**
 * Un número de daño tuyo, con el extra separado y en su color.
 *
 * `8 (6 + 2)`: lo que hace, lo que hacía, y de dónde sale la diferencia. El
 * extra sale de vencer profesores, del café, y de lo que te resten los
 * defectos — todo junto, porque todo se aplica junto.
 *
 * Va en oro, que es el color con el que la recompensa anuncia ese bonus cuando
 * lo ganás; si el extra fuera negativo va en malo, que es el color de lo que te
 * saca. Cuando no hay extra se muestra el número solo: un `(6 + 0)` sería ruido.
 */
function Golpe({ state, base }: { state: State; base: number }) {
  const total = dañoDe(state, base);
  const extra = total - base;
  if (extra === 0) return <>{total}</>;
  return (
    <>
      {total}{" "}
      <span className="text-dim">
        ({base}{" "}
        <span className={extra > 0 ? "text-oro" : "text-malo"}>
          {extra > 0 ? "+" : "−"}
          {Math.abs(extra)}
        </span>
        )
      </span>
    </>
  );
}

function pctDe(state: State, base: number): number {
  return Math.round(punteria(state, base) * 100);
}

export default function Juego() {
  const [state, setState] = useState<State | null>(null);
  const dispatch = (a: Action) => setState((s) => (s ? reduce(s, a) : s));
  // La posición vive acá arriba para que entrar y salir de un aula no te
  // teletransporte al principio del pasillo.
  const pos = useRef<{ x: number; y: number } | null>(null);
  const cicloAnterior = useRef(1);
  const [verInventario, setVerInventario] = useState(false);
  /*
   * Lo que se está contando de la entrada a un aula. Mientras esté puesto tapa
   * todo, y la secuencia del log espera: si no esperara, el primer aviso del
   * enemigo se consumiría atrás del umbral y entrarías a la pelea sin haberlo
   * leído.
   */
  const [umbral, setUmbral] = useState<DatoUmbral | null>(null);
  /** El texto de la entrada, entre apretar ENTRAR y estar en el pasillo. */
  const [historia, setContandoHistoria] = useState(false);
  // La secuencia también vive acá: el golpe que mata cambia de pantalla, y
  // esas líneas tienen que terminar de verse igual.
  const { actual, contando, restantes } = useSecuencia(
    state?.log ?? SIN_LOG,
    umbral !== null || historia,
  );

  const empezar = () => {
    // Los navegadores no dejan sonar hasta que el jugador toca algo, y esto es
    // lo primero que toca.
    despertarSonido();
    sonar("boton");
    pos.current = null;
    setState(initialState());
    setContandoHistoria(true);
  };
  /*
   * El aula no se abandona en medio de una secuencia.
   *
   * El motor pasa a "muerto" o a "recompensa" en el mismo despacho en que
   * resuelve el turno, así que la pantalla del combate se desmontaba con toda
   * la mano todavía encolada: hacías tu acción, y lo siguiente que veías era la
   * pantalla de muerte. El turno del enemigo —lo que decidió, lo que ejecutó y
   * cuánto te sacó— no llegaba a existir.
   *
   * Se guarda el último estado en combate y se lo sigue mostrando hasta que la
   * cola se vacíe. No hay riesgo de quedar trabado: mientras `contando` los
   * botones ya estaban bloqueados, así que no se pierde ninguna interacción.
   */
  const ultimoCombate = useRef<State | null>(null);
  if (state?.fase === "combate") ultimoCombate.current = state;
  else if (!contando) ultimoCombate.current = null;
  const congelado =
    state && state.fase !== "combate" && contando && ultimoCombate.current?.combate
      ? ultimoCombate.current
      : null;

  /*
   * Entrar se resuelve acá y no en `dispatch` porque el umbral necesita el
   * estado de después: qué había atrás de la puerta se sabe recién cuando el
   * motor lo sorteó. Se reduce una sola vez y se guarda ese mismo resultado.
   */
  const entrarAlAula = (p: Puerta) => {
    if (!state) return;
    const siguiente = reduce(state, {
      type: "entrar-aula",
      puertaX: p.x,
      puertaY: p.y,
    });
    if (siguiente === state) return;
    setUmbral(leerUmbral(siguiente, p));
    setState(siguiente);
  };

  if (!state) return <Portada onStart={empezar} />;

  if (state.ciclo !== cicloAnterior.current) {
    cicloAnterior.current = state.ciclo;
    pos.current = null;
  }

  // Sólo los estados frenan la pantalla entera; el resto va en línea.
  const evento = actual?.icono ? (
    <EventoEfecto entrada={actual} k={restantes} />
  ) : actual?.escudoUsado ? (
    <EventoEscudo entrada={actual} k={restantes} />
  ) : null;
  const inventario = verInventario ? (
    <Inventario state={state} onCerrar={() => setVerInventario(false)} />
  ) : null;
  const puerta = umbral ? (
    <Umbral dato={umbral} onFin={() => setUmbral(null)} />
  ) : null;
  const entrada = historia ? (
    <Historia onFin={() => setContandoHistoria(false)} />
  ) : null;

  // Huir también cierra el aula, y su línea también hay que verla.
  if (state.fase === "pasillo" && state.mundo && !congelado) {
    return (
      <>
        {evento}
        {inventario}
        {entrada}
        <Pasillo
          onInventario={() => setVerInventario(true)}
          state={state}
          mundo={state.mundo}
          pos={pos}
          onEntrar={entrarAlAula}
        />
      </>
    );
  }

  return (
    <>
      {evento}
      {inventario}
      {puerta}
      {entrada}
      {/*
        El combate entra entero en la pantalla y no se scrollea: mirar para
        abajo en medio de un turno es perder el hilo de lo que está pasando.
        El resto de las pantallas sí puede crecer.
      */}
      <main
        className={`grano mx-auto flex w-full max-w-xl flex-col px-5 ${
          congelado ||
          state.fase === "combate" ||
          state.fase === "recompensa" ||
          state.fase === "juego"
            ? "h-dvh gap-3 overflow-hidden py-4"
            : "flex-1 gap-5 py-8"
        }`}
      >
        {state.fase !== "sueño" && (
          <Cabecera
            state={congelado ?? state}
            momento={actual}
            onInventario={() => setVerInventario(true)}
          />
        )}
        {(congelado || state.fase === "combate") && (
          <Combate
            state={congelado ?? state}
            dispatch={dispatch}
            contando={contando}
            actual={actual}
            restantes={restantes}
          />
        )}
        {/*
          Las pantallas que no son el combate entran con un fundido corto.
          Ganar una pelea te lleva a la recompensa en el mismo despacho, y ese
          salto era lo único seco que quedaba después de un turno entero de
          cosas graduales — que es justo donde más se nota.
        */}
        {!congelado && state.fase === "juego" && state.minijuego && (
          <Juegito juego={state.minijuego} dispatch={dispatch} />
        )}
        {!congelado && state.fase === "recompensa" && (
          <Recompensa state={state} dispatch={dispatch} contando={contando} />
        )}
        {!congelado && state.fase === "sueño" && (
          <Sueño state={state} dispatch={dispatch} />
        )}
        {!congelado && (state.fase === "muerto" || state.fase === "fin") && (
          <Final state={state} onRestart={empezar} />
        )}
      </main>
    </>
  );
}

// --- portada --------------------------------------------------------------

/**
 * La portada no cuenta nada. Antes tenía las dos líneas de la premisa acá
 * arriba, compitiendo con el título y con el botón: el que quiere jugar las
 * saltea y el que quiere leerlas las lee mientras mira un botón. Ahora la
 * historia vive donde se puede escuchar —entre apretar ENTRAR y llegar al
 * pasillo— y acá queda sólo el nombre y una cosa que respira.
 */
function Portada({ onStart }: { onStart: () => void }) {
  return (
    <main className="grano mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-12 px-6 py-24">
      <h1 className="text-7xl font-bold tracking-[0.08em] text-agua drop-shadow-[0_0_28px_rgba(63,217,196,0.35)]">
        VIGILIA
      </h1>
      <EnPie materiaId="biologia" clase="respira" />
      <button
        onClick={onStart}
        className="w-full bg-agua px-8 py-4 text-sm font-bold tracking-[0.2em] text-background transition-opacity hover:opacity-80"
      >
        ENTRAR
      </button>
    </main>
  );
}

/*
 * Las líneas de la entrada. Cortas y de a una: lo que hace que se lean es que
 * no haya nada más en la pantalla mientras están.
 */
const HISTORIA = [
  "Hace tres días que no dormís.",
  "El colegio abre a las siete.",
  "Ya no estás seguro de cuál de los dos mundos te espera despierto.",
];
/** Cuánto queda cada línea sola antes de que entre la siguiente. */
const BEAT_HISTORIA = 2300;

/**
 * El pasaje entre apretar ENTRAR y estar caminando el pasillo.
 *
 * Las líneas entran de a una y las anteriores se apagan sin irse, así que lo
 * que se lee último queda apoyado sobre lo que se leyó antes. Al final la
 * pantalla se va en negro y recién ahí aparece el pasillo: cortar de una línea
 * de texto directo al canvas es el salto que hay que evitar.
 */
function Historia({ onFin }: { onFin: () => void }) {
  const [linea, setLinea] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    if (linea < HISTORIA.length) {
      const t = setTimeout(() => setLinea((l) => l + 1), BEAT_HISTORIA);
      return () => clearTimeout(t);
    }
    // El último respiro con todo puesto, y después el fundido.
    const t = setTimeout(() => setSaliendo(true), 900);
    return () => clearTimeout(t);
  }, [linea]);

  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => fin.current(), FUNDIDO);
    return () => clearTimeout(t);
  }, [saliendo]);

  useEffect(() => {
    const saltar = (e: KeyboardEvent | Event) => {
      if ("repeat" in e && (e as KeyboardEvent).repeat) return;
      setSaliendo(true);
    };
    window.addEventListener("keydown", saltar);
    window.addEventListener("pointerdown", saltar);
    return () => {
      window.removeEventListener("keydown", saltar);
      window.removeEventListener("pointerdown", saltar);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-background px-10 transition-opacity ease-in ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FUNDIDO}ms` }}
    >
      {HISTORIA.map((t, i) => (
        <p
          key={t}
          className={`max-w-md text-center text-lg leading-relaxed transition-all duration-1000 ${
            i > linea
              ? "translate-y-1 opacity-0"
              : i === linea
                ? "text-foreground opacity-100"
                : "text-dim opacity-45"
          }`}
        >
          {t}
        </p>
      ))}
    </div>
  );
}

// --- el pasillo -----------------------------------------------------------

/** Dibuja un glifo de texto (5×5) en el canvas. */
function glifo(
  ctx: CanvasRenderingContext2D,
  data: string[],
  x: number,
  y: number,
  px: number,
) {
  const base = ctx.globalAlpha;
  data.forEach((fila, gy) =>
    fila.split("").forEach((ch, gx) => {
      if (ch === ".") return;
      ctx.globalAlpha = ch === "+" ? base * 0.42 : base;
      ctx.fillRect(x + gx * px, y + gy * px, px, px);
    }),
  );
  ctx.globalAlpha = base;
}

function Pasillo({
  state,
  mundo,
  pos,
  onEntrar,
  onInventario,
}: {
  state: State;
  mundo: Mundo;
  pos: React.RefObject<{ x: number; y: number } | null>;
  onEntrar: (p: Puerta) => void;
  onInventario: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cerca, setCerca] = useState<Puerta | null>(null);
  const entrarRef = useRef(onEntrar);
  entrarRef.current = onEntrar;

  /**
   * Joystick virtual estilo Soul Knight: tocás donde quieras y ese punto pasa
   * a ser el centro. Nada de una cruceta fija en una esquina que obliga a
   * mirarse el pulgar.
   */
  const joy = useRef({ dx: 0, dy: 0 });
  const [joyVis, setJoyVis] = useState<{
    ox: number;
    oy: number;
    kx: number;
    ky: number;
  } | null>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const RADIO = 46;

  const tocar = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const caja = e.currentTarget.getBoundingClientRect();
    origen.current = { x: e.clientX - caja.left, y: e.clientY - caja.top };
    setJoyVis({ ox: origen.current.x, oy: origen.current.y, kx: 0, ky: 0 });
  };

  const arrastrar = (e: React.PointerEvent) => {
    if (!origen.current) return;
    const caja = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - caja.left - origen.current.x;
    let dy = e.clientY - caja.top - origen.current.y;
    const largo = Math.hypot(dx, dy);
    if (largo > RADIO) {
      dx = (dx / largo) * RADIO;
      dy = (dy / largo) * RADIO;
    }
    // Zona muerta chica, para que apoyar el dedo no te haga caminar.
    joy.current = largo < 8 ? { dx: 0, dy: 0 } : { dx: dx / RADIO, dy: dy / RADIO };
    setJoyVis((v) => (v ? { ...v, kx: dx, ky: dy } : v));
  };

  const soltar = () => {
    origen.current = null;
    joy.current = { dx: 0, dy: 0 };
    setJoyVis(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (!pos.current) pos.current = { ...mundo.inicio };

    const teclas = new Set<string>();
    let mirando = { x: 1, y: 0 };
    let raf = 0;
    let anterior = performance.now();

    const abajo = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      teclas.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e"].includes(k)) {
        e.preventDefault();
      }
      if (k === "e" || k === " ") {
        const p = puertaCerca(mundo, pos.current!);
        if (p && !p.usada) entrarRef.current(p);
      }
    };
    const arriba = (e: KeyboardEvent) => teclas.delete(e.key.toLowerCase());
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);

    const frame = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - anterior) / 1000);
      anterior = ahora;
      const p = pos.current!;

      let dx = 0;
      let dy = 0;
      if (teclas.has("a") || teclas.has("arrowleft")) dx -= 1;
      if (teclas.has("d") || teclas.has("arrowright")) dx += 1;
      if (teclas.has("w") || teclas.has("arrowup")) dy -= 1;
      if (teclas.has("s") || teclas.has("arrowdown")) dy += 1;
      // El joystick manda si lo estás usando; el teclado si no.
      if (joy.current.dx || joy.current.dy) {
        dx = joy.current.dx;
        dy = joy.current.dy;
      }
      if (dx || dy) {
        const largo = Math.hypot(dx, dy);
        // Con joystick el largo también gradúa la velocidad.
        const paso = VELOCIDAD * dt * Math.min(1, largo);
        const nueva = mover(mundo, p, (dx / largo) * paso, (dy / largo) * paso);
        mirando = { x: Math.sign(dx), y: Math.sign(dy) };
        p.x = nueva.x;
        p.y = nueva.y;
      }

      const puerta = puertaCerca(mundo, p);
      setCerca((prev) => (prev === puerta ? prev : puerta));

      const escala = 3;
      const anchoVista = canvas.width / escala;
      const altoVista = canvas.height / escala;
      const camX = Math.max(0, Math.min(mundo.ancho * TILE - anchoVista, p.x - anchoVista / 2));
      const camY = Math.max(0, Math.min(mundo.alto * TILE - altoVista, p.y - altoVista / 2));
      ctx.setTransform(escala, 0, 0, escala, -camX * escala, -camY * escala);
      ctx.fillStyle = "#05100e";
      ctx.fillRect(camX, camY, anchoVista, altoVista);

      // Paredes, piso y aulas de fondo.
      for (let ty = 0; ty < mundo.alto; ty++) {
        for (let tx = 0; tx < mundo.ancho; tx++) {
          const t = tileEn(mundo, tx, ty);
          const X = tx * TILE;
          const Y = ty * TILE;
          if (t === PISO) {
            ctx.fillStyle = "#0d1f1c";
            ctx.fillRect(X, Y, TILE, TILE);
            // Baldosas: junta abajo y a la derecha.
            ctx.fillStyle = "#112824";
            ctx.fillRect(X, Y + TILE - 1, TILE, 1);
            ctx.fillRect(X + TILE - 1, Y, 1, TILE);
          } else if (t === SALA) {
            // El aula se ve a través de la pared, apagada.
            ctx.fillStyle = ty % 2 === 0 ? "#091613" : "#0a1815";
            ctx.fillRect(X, Y, TILE, TILE);
          } else {
            // Pared de bloques, con la hilada corrida una fila sí y una no.
            ctx.fillStyle = "#0a1512";
            ctx.fillRect(X, Y, TILE, TILE);
            ctx.fillStyle = "#0e1d19";
            ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = "#0a1512";
            const corrida = ty % 2 === 0 ? 0 : TILE / 2;
            ctx.fillRect(X + corrida, Y, 1, TILE);
            // Zócalo donde la pared toca el pasillo.
            if (tileEn(mundo, tx, ty + 1) === PISO) {
              ctx.fillStyle = "#16302b";
              ctx.fillRect(X, Y + TILE - 2, TILE, 2);
            }
          }
        }
      }

      // Luz saliendo de cada puerta que todavía no usaste.
      for (const pu of mundo.puertas) {
        if (pu.usada) continue;
        const cx = pu.x * TILE + TILE / 2;
        const cy = pu.y * TILE + TILE / 2;
        const luz = ctx.createRadialGradient(cx, cy, 1, cx, cy, TILE * 2.6);
        const tono = pu.profesor ? "226,104,92" : "63,217,196";
        luz.addColorStop(0, `rgba(${tono},0.20)`);
        luz.addColorStop(1, `rgba(${tono},0)`);
        ctx.fillStyle = luz;
        ctx.fillRect(cx - TILE * 2.6, cy - TILE * 2.6, TILE * 5.2, TILE * 5.2);
      }

      // El símbolo de cada materia, difuminado, en el fondo de su aula.
      for (const pu of mundo.puertas) {
        const icono = ICONOS[pu.materiaId] ?? ICONOS.matematica;
        const cx = ((pu.sala.x0 + pu.sala.x1 + 1) / 2) * TILE - 7.5;
        const cy = ((pu.sala.y0 + pu.sala.y1 + 1) / 2) * TILE - 7.5;
        ctx.globalAlpha = pu.usada ? 0.07 : 0.16;
        ctx.fillStyle = pu.profesor ? "#e2685c" : "#3fd9c4";
        glifo(ctx, icono, cx, cy, 3);
        ctx.globalAlpha = 1;
      }

      // Las puertas, con forma de puerta.
      for (const pu of mundo.puertas) {
        const dx0 = pu.x * TILE;
        const dy0 = pu.y * TILE;
        const marco = pu.usada ? "#0f2a26" : pu.profesor ? "#5a231e" : "#12554c";
        const hoja = pu.usada ? "#0b1f1c" : pu.profesor ? "#8a3b33" : "#1c6b60";
        const detalle = pu.usada ? "#1c3f39" : pu.profesor ? "#e2685c" : "#3fd9c4";
        ctx.fillStyle = marco;
        ctx.fillRect(dx0 + 1, dy0 + 1, TILE - 2, TILE - 1);
        ctx.fillStyle = hoja;
        ctx.fillRect(dx0 + 3, dy0 + 3, TILE - 6, TILE - 3);
        ctx.fillStyle = detalle;
        // Picaporte y umbral.
        ctx.fillRect(dx0 + TILE - 6, dy0 + 9, 2, 2);
        ctx.fillRect(dx0 + 3, dy0 + 3, TILE - 6, 1);
        // El cartel con el símbolo, del lado del pasillo.
        const arriba = pu.y < 5;
        const sy = arriba ? dy0 + TILE + 1 : dy0 - 7;
        if (!pu.profesor) {
          ctx.globalAlpha = pu.usada ? 0.3 : 1;
          glifo(ctx, ICONOS[pu.materiaId] ?? ICONOS.matematica, dx0 + 5, sy, 1.2);
          ctx.globalAlpha = 1;
        }
      }

      // El chico: sombra al pie, cuerpo con un lado más oscuro, y la mirada.
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + CUERPO / 2, CUERPO * 0.55, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cfe3de";
      ctx.fillRect(p.x - CUERPO / 2, p.y - CUERPO / 2, CUERPO, CUERPO);
      ctx.fillStyle = "#8aa9a1";
      ctx.fillRect(p.x + CUERPO / 2 - 2, p.y - CUERPO / 2, 2, CUERPO);
      ctx.fillRect(p.x - CUERPO / 2, p.y + CUERPO / 2 - 2, CUERPO, 2);
      ctx.fillStyle = "#05100e";
      ctx.fillRect(p.x - 2 + mirando.x * 3, p.y - 2 + mirando.y * 3, 4, 2);

      // Viñeta: el pasillo se pierde en negro hacia los bordes.
      const vin = ctx.createRadialGradient(
        p.x,
        p.y,
        TILE * 2,
        p.x,
        p.y,
        Math.max(anchoVista, altoVista) * 0.75,
      );
      vin.addColorStop(0, "rgba(5,16,14,0)");
      vin.addColorStop(1, "rgba(5,16,14,0.92)");
      ctx.fillStyle = vin;
      ctx.fillRect(camX, camY, anchoVista, altoVista);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
    };
  }, [mundo, pos]);

  const c = confundido(state);

  return (
    <main className="grano mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-8">
      <Cabecera state={state} onInventario={onInventario} />

      <div
        className="relative touch-none border border-dimmer select-none"
        onPointerDown={tocar}
        onPointerMove={arrastrar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerLeave={soltar}
      >
        <canvas
          ref={canvasRef}
          width={720}
          height={340}
          className="w-full"
          style={{ imageRendering: "pixelated" }}
        />

        {/* El joystick aparece donde apoyaste el dedo y desaparece al soltar. */}
        {joyVis && (
          <>
            <div
              className="pointer-events-none absolute rounded-full border-2 border-agua/30"
              style={{
                left: joyVis.ox - RADIO,
                top: joyVis.oy - RADIO,
                width: RADIO * 2,
                height: RADIO * 2,
              }}
            />
            <div
              className="pointer-events-none absolute rounded-full bg-agua/70"
              style={{
                left: joyVis.ox + joyVis.kx - 16,
                top: joyVis.oy + joyVis.ky - 16,
                width: 32,
                height: 32,
              }}
            />
          </>
        )}

        {/* Botón de acción para mobile: aparece sólo si hay algo que abrir. */}
        {cerca && !cerca.usada && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              entrarRef.current(cerca);
            }}
            /*
              Siempre visible. Estaba con `md:hidden`, así que en cualquier
              pantalla de 768px para arriba desaparecía — y la única alternativa
              era la tecla [E]. En una tablet eso significa que no hay ninguna
              forma de entrar a un aula: te quedás caminando el pasillo para
              siempre. Un control que existe sólo en una de las dos formas de
              jugar no es un atajo, es una puerta cerrada.
            */
            className="absolute right-3 top-3 rounded-full bg-agua px-5 py-3 text-sm font-bold tracking-widest text-background"
          >
            ENTRAR
          </button>
        )}

        {cerca && (
          <div className="absolute inset-x-0 bottom-0 border-t border-agua bg-background/95 p-3">
            {cerca.usada ? (
              <p className="text-center text-sm text-dim">Ya entraste acá.</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-bold ${cerca.profesor ? "text-malo" : "text-agua"}`}>
                    {cerca.profesor
                      ? ENEMIGOS[cerca.enemigoId].nombre
                      : nombreDe(state, cerca.materiaId)}
                  </span>
                  <span className="text-sm text-dim">[E] entrar</span>
                </div>
                {!cerca.profesor && (
                  <ul className="mt-1 flex flex-wrap gap-x-4">
                    {cerca.lecturas.map((l) => (
                      <li key={l.suceso} className="text-sm text-dim">
                        <span className="tabular-nums text-foreground">
                          {num(l.prob, c)}%
                        </span>{" "}
                        {l.suceso === "pelea" ? (
                          <span className="text-malo">
                            pelea: {ENEMIGOS[l.enemigoId!].nombre}
                          </span>
                        ) : l.suceso === "bendicion" ? (
                          <span className="text-salud">no hay nadie</span>
                        ) : (
                          <span className="text-oro">algo raro</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-dim">
        WASD, flechas o arrastrá el dedo · [E] para entrar · al fondo del
        pasillo está el profesor
      </p>
      <Bitacora state={state} />
    </main>
  );
}

// --- piezas ---------------------------------------------------------------

/**
 * Dibuja una grilla de texto como bloques. `#` es el color pleno y `+` una
 * versión apagada: con esos dos tonos las figuras tienen contorno y relleno.
 */
function Pixeles({
  data,
  clase = "",
  muriendo,
}: {
  data: string[];
  clase?: string;
  muriendo?: boolean;
}) {
  const cols = data[0].length;
  const filas = data.length;
  return (
    <div
      className={`grid ${clase} ${muriendo ? "muere" : ""}`}
      style={{
        // `1fr` a secas es `minmax(auto, 1fr)`: con celdas de proporción fija
        // se arma una dependencia circular de tamaño y las columnas crecen
        // más allá del contenedor, así que el ancho declarado no lo contiene.
        // `minmax(0, 1fr)` corta eso.
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
        // La proporción va en la caja, no en cada celda.
        aspectRatio: `${cols} / ${filas}`,
      }}
      aria-hidden
    >
      {data.flatMap((fila, y) =>
        fila.split("").map((ch, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              background: ch === "." ? "transparent" : "currentColor",
              opacity: ch === "+" ? 0.42 : 1,
              // Cada píxel se suelta un poco después que el de al lado.
              animationDelay: muriendo ? `${(y * cols + x) * 7}ms` : undefined,
            }}
          />
        )),
      )}
    </div>
  );
}

function Sprite({
  materiaId,
  clase = "",
  muriendo,
}: {
  materiaId: string;
  clase?: string;
  muriendo?: boolean;
}) {
  return (
    <Pixeles
      data={SPRITES[materiaId] ?? SPRITES.matematica}
      clase={`w-24 sm:w-28 text-agua ${clase}`}
      muriendo={muriendo}
    />
  );
}

/** El sprite con una sombra elíptica abajo, para que no flote. */
function EnPie({
  materiaId,
  clase = "",
  muriendo,
}: {
  materiaId: string;
  clase?: string;
  muriendo?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <Sprite materiaId={materiaId} clase={clase} muriendo={muriendo} />
      <div
        className={`mt-1.5 h-1.5 w-20 rounded-[50%] bg-agua/15 blur-[2px] transition-opacity duration-700 ${
          muriendo ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}

// --- el umbral ------------------------------------------------------------

/** Lo que hace falta para contar la entrada a un aula. */
type DatoUmbral = {
  materiaId: string;
  materia: string;
  que: "pelea" | "bendicion" | "juego";
  enemigoId?: string;
  itemId?: string;
};

/** Qué había atrás de la puerta, leído del estado que devolvió el motor. */
function leerUmbral(s: State, p: Puerta): DatoUmbral {
  const base = { materiaId: p.materiaId, materia: nombreDe(s, p.materiaId) };
  if (s.combate) return { ...base, que: "pelea", enemigoId: s.combate.enemigoId };
  if (s.fase === "juego") return { ...base, que: "juego" };
  const item = s.botin.find((b) => b.tipo === "item");
  return { ...base, que: "bendicion", itemId: item?.id };
}

/**
 * El umbral: lo que pasa entre abrir la puerta y ver qué hay.
 *
 * Entrar a un aula tiene que dar miedo, y el miedo no está en lo que hay
 * adentro sino en el rato en que todavía no sabés qué hay. Por eso los tres
 * finales posibles comparten la misma caja, el mismo ritmo y la misma luz hasta
 * el beat de revelar: si el aula vacía se viera distinta desde el primer frame,
 * no habría suspenso, habría un cartel.
 *
 * El aula vacía tiene un beat de más. Primero ves que no hay nadie —que es el
 * momento en que aflojás— y recién después aparece lo que había.
 *
 * Se puede adelantar tocando o con cualquier tecla: en la run número diez el
 * suspenso ya lo viste, y hacerlo obligatorio lo convertiría en un peaje.
 */
function Umbral({ dato, onFin }: { dato: DatoUmbral; onFin: () => void }) {
  const [paso, setPaso] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const beats =
    dato.que === "bendicion" && dato.itemId ? [...BEATS_UMBRAL, BEAT_PREMIO] : BEATS_UMBRAL;
  // Por ref, para que volver a pintar no reinicie el reloj del beat en curso.
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    if (paso >= beats.length) {
      setSaliendo(true);
      return;
    }
    // La luz subiendo, lo que hay adentro tomando forma, y lo que había.
    if (paso === 1) sonar("umbral");
    else if (paso === 2) sonar(dato.que === "pelea" ? "enemigo" : "revelar");
    else if (paso === 3) sonar("hallazgo");
    const t = setTimeout(() => setPaso((p) => p + 1), beats[paso]);
    return () => clearTimeout(t);
  }, [paso, beats.length, dato.que]);

  /*
   * El aula no aparece de un frame al otro. Antes el umbral se desmontaba en
   * cuanto terminaba el último beat y el corte se sentía justo después de tres
   * segundos de todo gradual, que es donde más se nota.
   */
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => fin.current(), FUNDIDO);
    return () => clearTimeout(t);
  }, [saliendo]);

  useEffect(() => {
    // `repeat` es el auto-repeat de una tecla que quedó apretada: si venías
    // caminando con la W, se comería el umbral entero en un par de frames.
    const conTecla = (e: KeyboardEvent) => {
      if (!e.repeat) setPaso((p) => p + 1);
    };
    const conDedo = () => setPaso((p) => p + 1);
    window.addEventListener("keydown", conTecla);
    window.addEventListener("pointerdown", conDedo);
    return () => {
      window.removeEventListener("keydown", conTecla);
      window.removeEventListener("pointerdown", conDedo);
    };
  }, []);

  const item = dato.itemId ? ITEMS[dato.itemId] : null;
  /*
   * La puerta del profesor se lee desde el pasillo, así que teñir su luz de
   * rojo no delata nada que no supieras: es la única entrada del juego que
   * podés decidir no cruzar todavía.
   */
  const profe = !!dato.enemigoId && ENEMIGOS[dato.enemigoId].profesor;
  const luz = profe ? "rgba(226,104,92,0.18)" : "rgba(63,217,196,0.16)";

  return (
    <div
      className={`fixed inset-0 z-[55] flex flex-col items-center justify-center gap-7 overflow-hidden bg-background px-8 transition-opacity ease-in ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FUNDIDO}ms` }}
    >
      {/* La luz del aula subiendo. Es la misma en las tres: no puede delatar. */}
      {paso >= 1 && (
        <div
          className="luz-sube pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 65% 50% at 50% 45%, ${luz} 0%, transparent 72%)`,
          }}
        />
      )}

      <p
        className={`relative text-sm tracking-[0.35em] transition-opacity duration-1000 ${
          paso >= 1 ? "text-dim opacity-100" : "opacity-0"
        }`}
      >
        {dato.materia.toUpperCase()}
      </p>

      {/*
        La caja donde aparece lo que hay. Alto fijo: si creciera con el
        contenido, el salto del layout avisaría que algo apareció antes de que
        se vea qué es.
      */}
      <div className="relative flex h-44 w-full max-w-xs items-center justify-center">
        {paso >= 2 && dato.que === "pelea" && (
          <div className="revela">
            <EnPie materiaId={dato.materiaId} clase="respira" />
          </div>
        )}

        {paso >= 2 && dato.que === "juego" && (
          <div className="revela flex flex-col items-center gap-3">
            <Pixeles data={ICONOS[dato.materiaId]} clase="w-16 text-oro" />
          </div>
        )}

        {/* Vacía: primero el hueco, y el objeto recién en el beat siguiente. */}
        {paso === 2 && dato.que === "bendicion" && (
          <div className="revela h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(63,217,196,0.10),transparent_70%)]" />
        )}
        {paso >= 3 && item && (
          <>
            <div className="halo absolute h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(217,164,65,0.30),transparent_70%)]" />
            <div className="emerge relative">
              <Pixeles data={ICONOS_ITEM[dato.itemId!]} clase="w-24 text-oro" />
            </div>
          </>
        )}
      </div>

      <div className="relative flex h-16 flex-col items-center gap-1.5 text-center">
        {paso >= 2 && dato.que === "pelea" && (
          <p className="aparece text-xl leading-tight text-malo">
            {ENEMIGOS[dato.enemigoId!].nombre}
          </p>
        )}
        {paso >= 2 && dato.que === "juego" && (
          <p className="aparece text-xl leading-tight text-oro">Hay algo raro acá.</p>
        )}
        {paso === 2 && dato.que === "bendicion" && (
          <p className="aparece text-xl leading-tight text-dim">No hay nadie.</p>
        )}
        {paso >= 3 && item && (
          <>
            <p className="aparece text-sm tracking-[0.3em] text-dim">PERO HABÍA ESTO</p>
            <p className="aparece text-xl leading-tight text-oro">{item.nombre}</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * El interruptor del sonido. Vive al lado del bolsillo porque es lo mismo: algo
 * que se mira de reojo y no interrumpe. La preferencia queda guardada, así que
 * quien juega en silencio lo decide una sola vez.
 */
function Silencio() {
  const [mudo, setMudo] = useState(false);
  // El estado real vive en el módulo de sonido, que arranca recién en el primer
  // gesto; se lee al montar para no llegar desincronizado.
  useEffect(() => setMudo(estaMudo()), []);
  return (
    <button
      onClick={() => setMudo(alternarMudo())}
      title={mudo ? "Prender el sonido" : "Silenciar"}
      aria-label={mudo ? "Prender el sonido" : "Silenciar"}
      className={`shrink-0 border border-borde px-2.5 py-1 tracking-widest transition-colors hover:border-agua hover:text-foreground ${
        mudo ? "text-dim" : "text-agua"
      }`}
    >
      {mudo ? "🔇" : "🔊"}
    </button>
  );
}

function Barra({ valor, max, color = "bg-agua" }: { valor: number; max: number; color?: string }) {
  const bloques = 24;
  // Si seguís vivo tiene que verse algo: con 1 de vida el redondeo daba cero
  // y la barra parecía vacía estando en pie.
  const llenos = valor <= 0 ? 0 : Math.max(1, Math.round((valor / max) * bloques));
  return (
    <div className="flex gap-px">
      {Array.from({ length: bloques }, (_, i) => (
        <div key={i} className={`h-2.5 flex-1 ${i < llenos ? color : "bg-dimmer"}`} />
      ))}
    </div>
  );
}

/** Con confusión activa los números se muestran mal. */
function num(n: number, confuso: boolean): string {
  const s = String(Math.max(0, Math.round(n)));
  return confuso ? s.slice(0, -1) + "?" : s;
}

const NOMBRE_EFECTO: Record<string, string> = {
  confusion: "CONFUSIÓN",
  miedo: "MIEDO",
  torpeza: "TORPEZA",
};

/**
 * Etiqueta de estado. Al pasar por encima —o tocarla— explica qué te hace,
 * porque el nombre solo no alcanza para decidir.
 */
function Etiqueta({
  children,
  clase,
  explicacion,
}: {
  children: React.ReactNode;
  clase: string;
  explicacion: string;
}) {
  return (
    <span className="group inline-block">
      <span
        tabIndex={0}
        title={explicacion}
        className={`flex cursor-help items-center gap-1.5 px-2.5 py-1 ${clase}`}
      >
        {children}
      </span>
      {/*
        La explicación va fija abajo de todo y no colgada de la etiqueta: en la
        pantalla de combate, que no scrollea, un tooltip absoluto quedaba
        recortado por el borde. Además siempre aparece en el mismo lugar, que
        es más fácil de leer que perseguirlo por la pantalla.
      */}
      <span
        role="tooltip"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] hidden border-t border-agua bg-background/97 p-4 text-center text-base leading-snug text-foreground group-focus-within:block group-hover:block"
      >
        {explicacion}
      </span>
    </span>
  );
}

/**
 * El inventario completo, en una hoja. Se abre desde cualquier pantalla, no
 * gasta nada y no cambia el estado: es para mirar, no para usar.
 */
function Inventario({ state, onCerrar }: { state: State; onCerrar: () => void }) {
  const j = state.jugador;
  const pasivosDeSueño = j.poderes.filter((id) => PODERES[id].pasivo);
  const activos = j.poderes.filter((id) => !PODERES[id].pasivo);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        {/* El encabezado queda quieto y el contenido scrollea por debajo. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-borde px-5 py-4">
          <h2 className="truncate text-lg font-bold tracking-widest text-agua">
            LO QUE LLEVÁS
          </h2>
          <button
            onClick={onCerrar}
            className="shrink-0 border border-borde px-4 py-2 text-sm tracking-widest text-dim hover:border-agua hover:text-foreground"
          >
            CERRAR
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">

        <Seccion titulo="ARMAS" vacio="Con las manos.">
          {j.armas.map((id) => (
            <Ficha key={id} icono={ICONOS_ACCION.arma} tono="text-oro" nombre={ARMAS[id].nombre}>
              <Golpe state={state} base={ARMAS[id].daño} /> de daño · acierta{" "}
              {Math.round(punteriaArma(state, id) * 100)} de cada 100 ·{" "}
              {ARMAS[id].infinita
                ? "no se gasta"
                : `${ARMAS[id].usos} usos por pelea, se recargan en la siguiente`}
              {ARMAS[id].critico > 0 &&
                ` · ${Math.round(ARMAS[id].critico * 100)}% de pegar el doble`}
              {ARMAS[id].perdida
                ? ` · ${Math.round(ARMAS[id].perdida * 100)}% de perderla en un rebote`
                : ""}
            </Ficha>
          ))}
        </Seccion>

        <Seccion titulo="EN EL BOLSILLO" vacio="Nada.">
          {agrupar(j.items).map(([id, n]) => (
            <Ficha
              key={id}
              icono={ICONOS_ITEM[id]}
              tono={tonoItem(id)}
              nombre={ITEMS[id].nombre}
              cantidad={n}
              etiqueta={NOMBRE_RAREZA[ITEMS[id].rareza]}
            >
              {ITEMS[id].descripcion}
              {!!ITEMS[id].efecto.daño && (
                <>
                  {" "}
                  <Golpe state={state} base={ITEMS[id].efecto.daño} /> de daño.
                </>
              )}{" "}
              · acierta {pctDe(state, ITEMS[id].precision)} de cada 100 · no gasta el turno
            </Ficha>
          ))}
        </Seccion>

        <Seccion titulo="SOMBRAS" vacio="Todavía no venciste a nada.">
          {agrupar(j.sombras).map(([id, n]) => (
            <Ficha
              key={id}
              icono={ICONOS_EFECTO.confusion}
              tono="text-sueno"
              nombre={`la sombra de ${ENEMIGOS[id].nombre}`}
              cantidad={n}
            >
              Te saca los estados que tengas encima. De un solo uso.
            </Ficha>
          ))}
        </Seccion>

        <Seccion titulo="PODERES" vacio="El sueño todavía no te dio nada.">
          {activos.map((id) => (
            <Ficha
              key={id}
              icono={ICONOS_ACCION.usar}
              tono={PODERES[id].efecto.vida ? "text-salud" : "text-sueno"}
              nombre={PODERES[id].nombre}
            >
              {PODERES[id].texto} · acierta {pctDe(state, PODERES[id].precision)} de cada
              100 · {PODERES[id].usos} usos por pelea
            </Ficha>
          ))}
          {pasivosDeSueño.map((id) => (
            <Ficha
              key={id}
              icono={ICONOS_ACCION.bloquear}
              tono="text-sueno"
              nombre={PODERES[id].nombre}
              etiqueta="siempre activo"
            >
              {PODERES[id].texto}
            </Ficha>
          ))}
        </Seccion>

        <Seccion titulo="LO QUE TE COSTÓ" vacio="Todavía nada.">
          {j.defectos.map((id) => (
            <Ficha key={id} icono={ICONOS_EFECTO.torpeza} tono="text-malo" nombre={DEFECTOS[id].nombre}>
              {DEFECTOS[id].texto}
            </Ficha>
          ))}
        </Seccion>
        </div>
      </div>
    </div>
  );
}

/** Junta repetidos: ["agua","agua"] → [["agua", 2]] */
function agrupar(ids: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()];
}

function Seccion({
  titulo,
  vacio,
  children,
}: {
  titulo: string;
  vacio: string;
  children: React.ReactNode;
}) {
  // Puede llegar un array, varios arrays o un hijo suelto: se aplana todo.
  const hay = [children].flat(3).filter(Boolean).length > 0;
  return (
    <section className="space-y-2">
      <h3 className="text-sm tracking-[0.3em] text-dim">{titulo}</h3>
      {hay ? children : <p className="text-sm text-borde">{vacio}</p>}
    </section>
  );
}

function Ficha({
  icono,
  tono,
  nombre,
  cantidad,
  etiqueta,
  children,
}: {
  icono: string[];
  tono: string;
  nombre: string;
  cantidad?: number;
  etiqueta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border border-borde px-3 py-2.5">
      <Pixeles data={icono} clase={`mt-0.5 w-5 shrink-0 ${tono}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-base ${tono}`}>{nombre}</span>
          {cantidad && cantidad > 1 && (
            <span className="tabular-nums text-agua">×{cantidad}</span>
          )}
          {etiqueta && <span className="text-sm text-dim">{etiqueta}</span>}
        </div>
        <p className="mt-0.5 text-sm leading-snug text-dim">{children}</p>
      </div>
    </div>
  );
}

/** Cuántos usos mostrar de un arma: ∞ para las que no se gastan. */
function usosTexto(state: State, id: string): string {
  if (ARMAS[id].infinita) return "∞";
  return String(state.combate ? usosArma(state, id) : ARMAS[id].usos);
}

/**
 * La ficha de arriba, que lee `momento` y no el estado.
 *
 * El motor resuelve el turno entero de un saque, así que el estado ya tiene el
 * final cuando la secuencia recién va por el principio. Mostrarlo en vivo hacía
 * que la etiqueta de CONFUSIÓN apareciera mientras todavía se veía tu propio
 * ataque —antes del evento que te la aplica— y que se fuera antes de expirar.
 * Cada evento trae su foto; la ficha dibuja esa foto.
 */
function Cabecera({
  state,
  momento,
  onInventario,
}: {
  state: State;
  /** El evento que se está mostrando, si hay alguno. */
  momento?: Entrada | null;
  onInventario?: () => void;
}) {
  const j = state.jugador;
  const efectos = momento?.efectos ?? state.efectos;
  // Cuántos golpes te quedan cubiertos, de la foto del evento y no del estado.
  const escudo = momento?.escudo ?? state.combate?.escudo ?? 0;
  const c = efectos.some((e) => e.efecto === "confusion");
  const vida = momento?.vidaJugador ?? j.vida;
  return (
    <header className="shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="shrink-0 tracking-widest text-agua">
          CICLO {state.ciclo}/{CICLOS}
        </span>
        {onInventario && (
          <>
            <Silencio />
            <button
              onClick={onInventario}
              title="Ver todo lo que llevás"
              className="flex shrink-0 items-center gap-1.5 border border-borde px-2.5 py-1 tracking-widest text-dim transition-colors hover:border-agua hover:text-foreground"
            >
              <Pixeles data={ICONOS_ACCION.usar} clase="w-3 shrink-0 text-oro" />
              BOLSILLO
            </button>
          </>
        )}
      </div>
      {/* Las armas en su propio renglón: con tres puestas la lista es larga y
          chocaba contra el ciclo en pantallas angostas. */}
      <p className="truncate text-sm text-oro">
        {j.armas.length
          ? j.armas.map((id) => `${ARMAS[id].nombre} ×${usosTexto(state, id)}`).join(" · ")
          : "con las manos"}
      </p>
      <Barra valor={vida} max={j.vidaMax} />
      <div className="flex justify-between text-sm text-dim">
        <span className="tabular-nums">
          {num(vida, c)}/{num(j.vidaMax, c)}
        </span>
        <span>{j.items.length + j.sombras.length} en el bolsillo</span>
      </div>
      {/* Se apilan y se envuelven: si te agarran dos cosas, se ven las dos. */}
      {(efectos.length > 0 || escudo > 0 || j.defectos.length > 0) && (
        <div className="flex flex-wrap items-start gap-2 text-sm">
          {/*
            El escudo esperando el golpe. Va primero y con el ícono del item que
            lo puso, para que se lea como "los anteojos están puestos" y no como
            un estado más: sin esto, lo único que te decía que seguías cubierto
            era acordarte de haberlos usado.
          */}
          {escudo > 0 && (
            <Etiqueta
              clase="border border-sueno text-sueno"
              explicacion="Los anteojos están puestos: el próximo golpe que te entre no te toca, y ahí se gastan."
            >
              <Pixeles data={ICONOS_ITEM.anteojos} clase="w-3 shrink-0" />
              CUBIERTO
              {escudo > 1 && <span className="tabular-nums opacity-70">×{escudo}</span>}
            </Etiqueta>
          )}
          {efectos.map((e) => (
            <Etiqueta
              key={e.efecto}
              clase="bg-malo text-background"
              explicacion={EXPLICACION_EFECTO[e.efecto]}
            >
              <Pixeles data={ICONOS_EFECTO[e.efecto]} clase="w-3 shrink-0" />
              {NOMBRE_EFECTO[e.efecto]}
              <span className="tabular-nums opacity-70">{e.turnos}</span>
            </Etiqueta>
          ))}
          {j.poderes
            .filter((id) => PODERES[id].pasivo)
            .map((id) => (
              <Etiqueta
                key={id}
                clase="border border-agua text-agua"
                explicacion={PODERES[id].texto}
              >
                {PODERES[id].nombre}
              </Etiqueta>
            ))}
          {j.defectos.map((d) => (
            <Etiqueta
              key={d}
              clase="border border-sueno text-sueno"
              explicacion={DEFECTOS[d].texto}
            >
              {DEFECTOS[d].nombre}
            </Etiqueta>
          ))}
        </div>
      )}
    </header>
  );
}

// --- la secuencia del turno ----------------------------------------------

/**
 * Reproduce los eventos nuevos del log de a uno. Vive en un hook porque el
 * remate que mata al enemigo cambia de fase, y esas líneas también tienen que
 * verse: si no, el mejor momento del combate se lo come el cambio de pantalla.
 */
function useSecuencia(log: Entrada[], pausado = false) {
  const [cola, setCola] = useState<{ entrada: Entrada; dura: number }[]>([]);
  const [actual, setActual] = useState<Entrada | null>(null);
  const cabeza = useRef<Entrada | null | undefined>(undefined);

  useEffect(() => {
    if (cabeza.current === undefined) {
      cabeza.current = log[0] ?? null;
      return;
    }
    const i = cabeza.current ? log.indexOf(cabeza.current) : log.length;
    const nuevas = i === -1 ? log.length : i;
    cabeza.current = log[0] ?? null;
    if (nuevas <= 0) return;

    const cronologico = log.slice(0, nuevas).reverse();
    setCola(
      cronologico.map((entrada, k) => {
        // El aviso manda: es lo que el jugador tiene que leer para decidir.
        if (entrada.aviso) return { entrada, dura: RITMO_AVISO };
        // Y si hubo tirada, el reloj tiene que llegar a frenar.
        if (entrada.tirada) return { entrada, dura: RITMO_TIRADA };
        // Los anteojos aguantan medio segundo y después se rompen enteros.
        if (entrada.escudoUsado) return { entrada, dura: RITMO_ESCUDO };
        // El último evento de una mano se queda más tiempo: ese silencio es
        // el turno pasando de un lado al otro.
        const siguiente = cronologico[k + 1];
        const cambiaDeManos =
          !!siguiente && (siguiente.actor ?? "vos") !== (entrada.actor ?? "vos");
        return { entrada, dura: cambiaDeManos ? RITMO_TURNO : RITMO };
      }),
    );
  }, [log]);

  /** Lo último que se mostró, para saber en qué dirección se movió una vida. */
  const anterior = useRef<Entrada | null>(null);

  useEffect(() => {
    if (cola.length === 0) {
      setActual(null);
      return;
    }
    // Con el umbral puesto la cola queda esperando: los eventos de entrar al
    // aula no se pueden gastar atrás de una pantalla que los tapa.
    if (pausado) return;
    const [primero, ...resto] = cola;
    setActual(primero.entrada);
    /*
     * El sonido va acá y no en el despacho: el motor resuelve el turno entero
     * de un saque, así que sonar ahí sería escuchar el golpe que te mata
     * mientras la pantalla todavía muestra tu propio ataque. Es la misma regla
     * que las barras de vida.
     */
    const s = sonidoDe(primero.entrada, anterior.current);
    if (s) sonar(s);
    anterior.current = primero.entrada;
    const t = setTimeout(() => setCola(resto), primero.dura);
    return () => clearTimeout(t);
  }, [cola, pausado]);

  /*
   * La cola se arma en un efecto, o sea después de pintar. En el render en que
   * llega el log nuevo todavía está vacía, y ese hueco de un frame alcanzaba
   * para que la pantalla se fuera del combate antes de mostrar nada.
   *
   * `pendiente` lo cubre sincrónicamente: si la cabeza del log no es la que
   * encolamos la última vez, hay eventos que todavía no se vieron.
   */
  const pendiente = cabeza.current !== undefined && log[0] !== cabeza.current;

  return {
    actual,
    contando: cola.length > 0 || pendiente,
    restantes: cola.length,
  };
}

/**
 * El oscurecido de toda la pantalla queda reservado para cuando te agarra un
 * estado: es lo bastante grave como para frenar todo. El resto de los eventos
 * se muestran en línea, sin tapar el combate.
 */
function EventoEfecto({ entrada, k }: { entrada: Entrada; k: number }) {
  if (!entrada.icono) return null;
  return (
    <div
      key={`fondo-${k}-${entrada.texto}`}
      className="pasa-por-encima fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-8"
    >
      <div
        key={`${k}-${entrada.texto}`}
        className="aparece flex max-w-sm flex-col items-center gap-4 text-center"
      >
        <span className="text-xs tracking-[0.35em] text-malo">ESO TE HIZO ESTO</span>
        <Pixeles data={ICONOS_EFECTO[entrada.icono]} clase="w-16 text-malo" />
        <p className="text-lg leading-snug text-malo">{entrada.texto}</p>
      </div>
    </div>
  );
}

/**
 * El escudo interponiéndose, y gastándose en el acto.
 *
 * Es el único evento bueno que se gana la pantalla entera, y se la gana por lo
 * mismo que se la gana un estado: pasó algo que cambia las reglas del turno.
 * Antes esto era una línea de texto más —"lo viste llegar y no te tocó"— y no
 * había forma de atarla al item que la causó ni de ver que se había consumido.
 *
 * Los anteojos se rompen píxel por píxel, con la misma animación con la que se
 * caen los enemigos.
 */
function EventoEscudo({ entrada, k }: { entrada: Entrada; k: number }) {
  return (
    <div
      key={`escudo-${k}-${entrada.texto}`}
      className="pasa-por-encima-largo fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-8"
    >
      <div className="aparece flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="text-xs tracking-[0.35em] text-sueno">SE INTERPUSIERON</span>
        <Pixeles
          data={ICONOS_ITEM.anteojos}
          clase="w-20 text-sueno rompe-tarde"
          muriendo
        />
        <p className="text-lg leading-snug text-sueno">{entrada.texto}</p>
        <span className="text-sm text-dim">Los anteojos se rompen ahí.</span>
      </div>
    </div>
  );
}

/**
 * Los eventos que se ganan la pantalla entera. El resto va en línea, arriba de
 * los botones, sin tapar el combate.
 */
function tapaLaPantalla(e: Entrada | null): boolean {
  return !!e && (!!e.icono || !!e.escudoUsado);
}

/**
 * El detalle numérico de lo que el enemigo va a intentar.
 *
 * El daño sale del motor, no de una cuenta a mano. Decía `daño × 1,15` —una
 * constante fósil de cuando `MULT_ENEMIGO` valía otra cosa— mientras el motor
 * pegaba `daño × 1,80 × escala del ciclo`, y encima ignoraba los defectos que
 * te hacen recibir más. O sea que el único número sobre el que se apoya la
 * decisión central del juego venía entre un 36% y un 56% corto.
 */
function numerosDe(state: State, i: Intencion): string {
  const prob = `${Math.round((i.precision ?? 0.85) * 100)}% de acertar`;
  if (i.tipo === "golpe") {
    const base = `golpe de ${dañoRecibidoDe(state, i.daño ?? 0)} · ${prob}`;
    return i.imparable ? `${base} · NO SE PUEDE BLOQUEAR` : base;
  }
  if (i.tipo === "cura") {
    return `se recompone ~${i.cura ?? 0} · cubrirte no lo frena`;
  }
  if (i.tipo === "efecto") {
    const base = `te deja ${(NOMBRE_EFECTO[i.efecto ?? ""] ?? "").toLowerCase()} · ${prob}`;
    return i.imparable ? `${base} · NO SE PUEDE BLOQUEAR` : base;
  }
  return "no hace nada este turno";
}

/** Un evento por vez, en el lugar donde vive el combate. */
function EventoEnLinea({
  entrada,
  k,
  numeros,
  ciego,
}: {
  entrada: Entrada;
  k: number;
  numeros?: string;
  /** Con el aviso tapado, la línea del enemigo decidiendo no dice qué eligió. */
  ciego?: boolean;
}) {
  const mio = (entrada.actor ?? "vos") === "vos" && !entrada.aviso;
  return (
    <div
      key={`${k}-${entrada.texto}`}
      className={`flex min-h-18 shrink-0 flex-col justify-center gap-1 px-4 py-2.5 ${
        entrada.aviso
          ? "entra-derecha border-l-2 border-agua bg-agua/5"
          : mio
            ? "entra-izquierda border-l-2 border-agua-hondo bg-agua/5 text-left"
            : "entra-derecha items-end border-r-2 border-malo bg-malo/8 text-right"
      }`}
    >
      <span
        className={`text-xs tracking-[0.35em] ${mio ? "text-agua-hondo" : "text-malo"}`}
      >
        {entrada.aviso ? "SE DECIDE" : mio ? "▸ VOS" : "ESO ◂"}
      </span>
      {/*
        Si hubo tirada, el texto espera a que la aguja pare. Mostrar el
        resultado escrito mientras el reloj todavía gira vacía el giro: ya
        sabrías cómo terminó antes de que termine.
      */}
      <p
        className={`text-base leading-snug ${
          entrada.aviso && ciego ? "text-sueno" : COLOR_FUERTE[entrada.tipo]
        } ${entrada.tirada ? "espera-la-aguja" : ""}`}
      >
        {entrada.aviso && ciego ? "Se decide, pero no llegás a ver qué." : entrada.texto}
      </p>
      {/* El número va pegado abajo del texto que lo describe en abstracto. */}
      {entrada.aviso && numeros && <p className="text-sm text-dim">{numeros}</p>}
    </div>
  );
}

// --- el reloj del aula ----------------------------------------------------

/** Cuánto tarda la aguja en frenar. */
const GIRO = 1050;

/**
 * El reloj del aula: la ruleta donde se ve ocurrir el azar.
 *
 * Todo lo que podés hacer tiene una chance declarada, y hasta ahora esa chance
 * se resolvía en silencio y aparecía ya cocinada en una línea de texto. Acá la
 * aguja gira sobre el mismo arco que el botón venía mostrando y cae del lado
 * que efectivamente tocó: el número deja de ser una promesa y pasa a ser algo
 * que mirás pasar.
 *
 * La aguja **nunca vuelve para atrás** y **nunca cae sobre la línea** que
 * separa los dos arcos. Lo primero porque un reloj que retrocede se lee como
 * un error; lo segundo porque ahí no se sabría de qué lado cayó.
 *
 * Queda colgado aunque no haya nada que tirar, apagado y con la aguja donde
 * paró la última vez. Es parte del aula, no un cartel que aparece.
 */
function Reloj({ tirada }: { tirada?: Entrada["tirada"] }) {
  const [angulo, setAngulo] = useState(0);
  /*
   * El arco se queda puesto después de que el evento pasó y se apaga con un
   * fundido. Si el color se fuera en el mismo frame en que cambia el evento,
   * un segundo entero de aguja frenando terminaría en un corte.
   */
  const [ultimo, setUltimo] = useState<Entrada["tirada"] | undefined>(undefined);
  const acumulado = useRef(0);
  const vista = useRef<Entrada["tirada"] | undefined>(undefined);

  useEffect(() => {
    if (!tirada || tirada === vista.current) return;
    vista.current = tirada;
    setUltimo(tirada);
    const arco = (tirada.prob / 100) * 360;
    /*
     * El arco bueno se parte en dos: lo que entra normal y lo que entra doble.
     * El pedazo de crítico va al final del arco bueno porque P(crítico) es
     * P(entra) × P(crítico|entra), que es exactamente cómo lo tira el motor: la
     * aguja cayendo ahí no es una licencia visual, es la cuenta.
     */
    const critico = tirada.critico ? arco * (1 - tirada.critico) : arco;
    // Un margen para que la aguja no quede parada justo sobre un límite: ahí no
    // se leería en qué pedazo cayó.
    const entre = (a: number, b: number) => {
      const m = Math.min(6, Math.max(1, (b - a) / 4));
      return a + m + Math.random() * Math.max(0.5, b - a - m * 2);
    };
    const destino = !tirada.salio
      ? entre(arco, 360)
      : tirada.fueCritico
        ? entre(critico, arco)
        : entre(0, critico);
    // Siempre para adelante: vueltas enteras sobre lo ya acumulado. Una aguja
    // que retrocede se lee como un error, no como suspenso.
    const desde = ((acumulado.current % 360) + 360) % 360;
    const recorrido = 3 * 360 + ((destino - desde + 360) % 360);
    acumulado.current += recorrido;
    setAngulo(acumulado.current);

    /*
     * Y suena mientras gira. Los tics arrancan pegados y se van separando hasta
     * que queda uno solo colgado justo antes de que pare: ese último silencio es
     * toda la tensión de la tirada. Salen de la misma curva que mueve la aguja,
     * así que no se pueden desfasar.
     */
    const relojes = ticsDeReloj(GIRO, recorrido, CURVA_AGUJA).map((ms) =>
      setTimeout(() => sonar("tic"), ms),
    );
    return () => relojes.forEach(clearTimeout);
  }, [tirada]);

  const activo = !!tirada;
  const arco = ultimo ? (ultimo.prob / 100) * 360 : 0;
  const corteCritico = ultimo?.critico ? arco * (1 - ultimo.critico) : arco;
  const esfera = ultimo?.critico
    ? `conic-gradient(var(--agua) 0deg ${corteCritico}deg, var(--oro) ${corteCritico}deg ${arco}deg, var(--malo) ${arco}deg 360deg)`
    : `conic-gradient(var(--agua) 0deg ${arco}deg, var(--malo) ${arco}deg 360deg)`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        {/* La esfera apagada, que es lo que se ve cuando no hay nada que tirar. */}
        <div className="absolute inset-0 rounded-full border border-borde bg-borde-suave" />
        {/* Y encima el arco de la tirada, que entra y sale con un fundido. */}
        <div
          className="absolute inset-0 rounded-full transition-opacity duration-700"
          style={{ background: esfera, opacity: activo ? 1 : 0 }}
        />
        {/* El centro apagado convierte el disco en un anillo. */}
        <div className="absolute inset-[6px] rounded-full bg-background" />
        {/* Las doce marcas, para que se lea como un reloj y no como un gráfico. */}
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-[5px] h-1.5 w-px bg-dim/40"
            style={{
              transformOrigin: "50% 27px",
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
            }}
          />
        ))}
        <div
          className="absolute bottom-1/2 left-1/2 h-[21px] w-[2px] transition-colors duration-700"
          style={{
            transformOrigin: "bottom center",
            transform: `translateX(-50%) rotate(${angulo}deg)`,
            background: activo ? "var(--foreground)" : "var(--dim)",
            // Arranca de golpe y frena largo: con una desaceleración corta el
            // final se sentiría como un tirón.
            transition: `transform ${GIRO}ms cubic-bezier(${CURVA_AGUJA.join(",")}), background 700ms`,
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
      </div>
      <span
        className={`text-xs tabular-nums transition-opacity duration-700 ${
          activo ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-dim">{ultimo ? `${ultimo.prob}%` : ""}</span>
        {!!ultimo?.critico && (
          <span className="text-oro"> · {Math.round(ultimo.critico * 100)}</span>
        )}
      </span>
    </div>
  );
}

// --- combate --------------------------------------------------------------

function Combate({
  state,
  dispatch,
  contando,
  actual,
  restantes,
}: {
  state: State;
  dispatch: (a: Action) => void;
  contando: boolean;
  actual: Entrada | null;
  restantes: number;
}) {
  const [menu, setMenu] = useState<"usar" | "armas" | null>(null);
  const [golpe, setGolpe] = useState(0);
  const vidaEnemigoPrev = useRef<number | null>(null);
  const vidaPrev = useRef(state.jugador.vida);
  const [herido, setHerido] = useState(0);

  const c = state.combate;
  // Se sigue el valor que se está mostrando, no el final: así la sacudida cae
  // en el mismo evento en que baja la barra.
  const vidaEnemigoVista = actual?.vidaEnemigo ?? c?.vida ?? null;

  // Sacudida del enemigo cuando le entra, y del borde cuando te entra a vos.
  useEffect(() => {
    const vidaEnemigo = vidaEnemigoVista;
    if (vidaEnemigo === null) return;
    if (vidaEnemigoPrev.current !== null && vidaEnemigo < vidaEnemigoPrev.current) {
      setGolpe((g) => g + 1);
    }
    vidaEnemigoPrev.current = vidaEnemigo;
  }, [vidaEnemigoVista]);

  // Lo mismo del lado tuyo: el destello va con el evento, no con el estado.
  const vidaJugadorVista = actual?.vidaJugador ?? state.jugador.vida;
  useEffect(() => {
    if (vidaJugadorVista < vidaPrev.current) setHerido((h) => h + 1);
    vidaPrev.current = vidaJugadorVista;
  }, [vidaJugadorVista]);

  /*
   * Agonía: abajo de un cuarto de vida se escucha el corazón y el borde de la
   * pantalla late con él.
   *
   * Es lo único que corre solo, sin que pase nada. Un roguelike se recuerda por
   * las veces que zafaste por poco, y para que zafar por poco se sienta, antes
   * tiene que sentirse que estabas por morir. El resto de la interfaz reacciona
   * a eventos; esto es un estado, y es el único que se gana serlo.
   */
  const agonizando = vidaJugadorVista > 0 && vidaJugadorVista <= state.jugador.vidaMax * 0.25;
  useEffect(() => {
    if (!agonizando) return;
    sonar("latido");
    const t = setInterval(() => sonar("latido"), 1500);
    return () => clearInterval(t);
  }, [agonizando]);

  if (!c) return null;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  /*
   * Los estados que se ven, que son los del evento que se está mostrando y no
   * los del estado final. Si no, los números se desordenaban por la confusión
   * antes de que se viera el evento que te la aplica.
   */
  const efectosVistos = actual?.efectos ?? state.efectos;
  const conf = efectosVistos.some((e) => e.efecto === "confusion");
  const j = state.jugador;
  // Con miedo encima, lo que vale es el producto de las dos tiradas.
  const ciego = !veElAviso(state);
  const losAvisos = avisos(state);
  // El mismo número que va a girar en el reloj: sale de la misma función.
  const pct = (p: number) => pctDe(state, p);

  const act = (accion: Accion, ref?: string) => {
    if (contando) return;
    sonar("boton");
    setMenu(null);
    dispatch({ type: "combate", accion, ref });
  };

  const vidaEnemigo = vidaEnemigoVista ?? c.vida;

  const guardado = [
    ...j.items.map((id, i) => ({
      ref: id,
      key: `i${i}`,
      icono: ICONOS_ITEM[id],
      texto: (
        <>
          {ITEMS[id].nombre} · {pct(ITEMS[id].precision)}% — {ITEMS[id].descripcion}
          {!!ITEMS[id].efecto.daño && (
            <>
              {" "}
              <Golpe state={state} base={ITEMS[id].efecto.daño} /> de daño.
            </>
          )}
        </>
      ),
      clase: tonoItem(id),
    })),
    ...j.sombras.map((id, i) => ({
      ref: `sombra:${id}`,
      key: `s${i}`,
      icono: ICONOS_EFECTO.confusion,
      texto: <>sombra de {ENEMIGOS[id].nombre} — te saca los estados que tengas encima</>,
      clase: "text-sueno",
    })),
    ...j.poderes
      .filter((id) => !PODERES[id].pasivo && usosPoder(state, id) > 0)
      .map((id) => ({
        ref: `poder:${id}`,
        key: id,
        icono: ICONOS_ACCION.usar,
        texto: (
          <>
            {PODERES[id].nombre} ×{usosPoder(state, id)} · {pct(PODERES[id].precision)}% —{" "}
            {PODERES[id].texto}
            {!!PODERES[id].efecto.daño && (
              <>
                {" "}
                <Golpe state={state} base={PODERES[id].efecto.daño} /> de daño.
              </>
            )}
          </>
        ),
        clase: PODERES[id].efecto.vida ? "text-salud" : "text-sueno",
      })),
  ];

  const usables = armasUsables(state);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      {agonizando && (
        <div className="agonia pointer-events-none fixed inset-0 z-30" aria-hidden />
      )}

      {/* Destello en toda la pantalla: te entró. */}
      {herido > 0 && (
        <div
          key={`destello-${herido}`}
          className="destello pointer-events-none fixed inset-0 z-50"
        />
      )}

      <div
        key={`herido-${herido}`}
        className={`relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border p-4 ${
          enemigo.profesor
            ? "border-malo bg-[radial-gradient(ellipse_at_center,rgba(226,104,92,0.09),transparent_70%)]"
            : "border-borde bg-[radial-gradient(ellipse_at_center,rgba(63,217,196,0.05),transparent_70%)]"
        } ${herido > 0 ? "sacude" : ""}`}
      >
        {/* El reloj está colgado en la pared del aula, a un costado. */}
        <div className="absolute right-3 top-3">
          <Reloj tirada={actual?.tirada} />
        </div>

        {/*
          Cuántos turnos te quedan para llevarte algo de más.
          Va a la vista y no como sorpresa al final: si te enterases recién al
          ganar, no sería una decisión, sería un premio consuelo. Puesto acá, es
          lo que hace que cubrirte un turno de más se sienta que cuesta algo.
        */}
        {c.turnos < TURNOS_RAPIDO && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-0.5">
            <span className="text-xs tracking-[0.3em] text-oro">ANTES DEL TIMBRE</span>
            <span className="text-sm tabular-nums text-dim">
              {TURNOS_RAPIDO - c.turnos}{" "}
              {TURNOS_RAPIDO - c.turnos === 1 ? "turno" : "turnos"}
            </span>
          </div>
        )}
        <div key={`golpe-${golpe}`} className={golpe > 0 ? "sacude" : "respira"}>
          <EnPie materiaId={c.materiaId} />
        </div>
        <p className="text-center text-lg leading-tight">{enemigo.nombre}</p>
        <div className="w-full space-y-1">
          <Barra valor={vidaEnemigo} max={c.vidaMax} color="bg-malo" />
          <div className="text-right text-sm tabular-nums text-dim">
            {num(vidaEnemigo, conf)}/{num(c.vidaMax, conf)}
          </div>
        </div>
      </div>

      {/*
        Un evento por vez, arriba de los botones. Cuando no queda nada por
        mostrar, el aviso vigente queda a la vista para poder decidir.

        Mientras la secuencia corre el aviso NO se muestra, ni siquiera cuando
        el evento del momento tapa la pantalla con un estado: en ese rato el
        motor ya avanzó el paso del enemigo, así que lo que diría es lo que va a
        hacer el turno que viene, adelantado. Y no hay nada que decidir todavía.
      */}
      {actual && !tapaLaPantalla(actual) ? (
        <EventoEnLinea
          entrada={actual}
          k={restantes}
          numeros={ciego ? undefined : numerosDe(state, intencion)}
          ciego={ciego}
        />
      ) : contando ? (
        <div className="min-h-18 shrink-0" />
      ) : (
        <div
          className={`flex min-h-18 shrink-0 flex-col justify-center gap-1 border-l-2 px-4 py-2.5 ${
            ciego ? "border-sueno" : "border-agua"
          }`}
        >
          <span className="text-xs tracking-[0.35em] text-dim">
            {ciego ? "NO SABÉS" : "VA A HACER"}
          </span>
          {ciego ? (
            <p className="text-base leading-snug text-sueno">
              Se mueve y no llegás a entender qué está por hacer.
            </p>
          ) : (
            losAvisos.map((av, i) => (
              <div key={i} className={i > 0 ? "border-t border-borde-suave pt-1" : ""}>
                <p
                  className={`leading-snug ${
                    i === 0 ? "text-base text-agua" : "text-sm text-agua-hondo"
                  }`}
                >
                  {i > 0 && <span className="text-dim">y después: </span>}
                  {av.tell}
                </p>
                <p className="text-sm text-dim">{numerosDe(state, av)}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className={`grid shrink-0 grid-cols-2 gap-2 ${contando ? "pointer-events-none opacity-40" : ""}`}>
        <Boton
          label="ATACAR"
          icono={ICONOS_ACCION.atacar}
          sub={
            <>
              <Golpe state={state} base={DAÑO_ATAQUE} /> · {pct(PRECISION_ATAQUE)}%
            </>
          }
          onClick={() => act("atacar")}
        />
        <Boton
          label="BLOQUEAR"
          icono={ICONOS_ACCION.bloquear}
          /*
            Lo que el bloqueo va a hacer *contra lo que viene*, no en abstracto.
            Sólo se devuelve contra un golpe —no hay nada que redirigir cuando lo
            que te tiran es un estado— y decirlo recién en el resultado hacía que
            la mitad de los bloqueos parecieran un contraataque roto.
          */
          sub={
            <>
              {ciego || losAvisos.some((av) => av.tipo === "golpe") ? (
                <>
                  para todo y devolvés <Golpe state={state} base={bloqueoDe(state).daño} />
                </>
              ) : (
                <>para todo, sin devolver</>
              )}{" "}
              · {pct(bloqueoDe(state).precision)}%
            </>
          }
          onClick={() => act("bloquear")}
        />
        <Boton
          label={usables.length ? "ARMA" : "SIN ARMA"}
          icono={ICONOS_ACCION.arma}
          tono="text-oro"
          sub={usables.length ? `${usables.length} a mano` : "—"}
          disabled={usables.length === 0}
          onClick={() => setMenu(menu === "armas" ? null : "armas")}
        />
        <Boton
          label="USAR"
          icono={ICONOS_ACCION.usar}
          tono="text-oro"
          sub={`${guardado.length} · no gasta turno`}
          disabled={guardado.length === 0}
          onClick={() => setMenu(menu === "usar" ? null : "usar")}
        />
      </div>

      {menu === "armas" && !contando && (
        <div className="max-h-32 shrink-0 space-y-1 overflow-y-auto border border-borde p-3">
          {usables.map((id) => (
            <button
              key={id}
              onClick={() => act("arma", id)}
              className="flex w-full items-center gap-2 text-left text-sm text-oro hover:text-foreground"
            >
              <Pixeles data={ICONOS_ACCION.arma} clase="w-3.5 shrink-0" />
              {ARMAS[id].nombre} — <Golpe state={state} base={ARMAS[id].daño} /> de daño ·{" "}
              {Math.round(punteriaArma(state, id) * 100)}% · {usosTexto(state, id)} usos
              {ARMAS[id].critico > 0 && ` · ${Math.round(ARMAS[id].critico * 100)}% crítico`}
            </button>
          ))}
        </div>
      )}

      {menu === "usar" && !contando && (
        <div className="max-h-32 shrink-0 space-y-1 overflow-y-auto border border-borde p-3">
          {guardado.map((g) => (
            <button
              key={g.key}
              onClick={() => act("usar", g.ref)}
              className={`flex w-full items-center gap-2 text-left text-sm hover:text-foreground ${g.clase}`}
            >
              {g.icono && <Pixeles data={g.icono} clase="w-3.5 shrink-0" />}
              {g.texto}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => act("huir")}
        disabled={!puedeHuir(state) || contando}
        className="w-full border border-dimmer p-2 text-sm tracking-widest text-dim hover:border-dim disabled:opacity-25"
      >
        {puedeHuir(state) ? "SALIR AL PASILLO" : "LA PUERTA NO ABRE"}
      </button>
    </section>
  );
}

function Boton({
  label,
  sub,
  icono,
  tono = "text-agua",
  disabled,
  onClick,
}: {
  label: string;
  /** Admite marcado: el daño lleva el extra en otro color. */
  sub?: React.ReactNode;
  /** El dibujo va al lado del texto, no en lugar de él. */
  icono?: string[];
  tono?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group border border-borde p-3 transition-all hover:border-agua hover:bg-agua/10 active:bg-agua/20 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-borde disabled:hover:bg-transparent"
    >
      <div className="flex items-center justify-center gap-2">
        {icono && <Pixeles data={icono} clase={`w-4 shrink-0 ${tono}`} />}
        <span className="truncate text-sm font-bold">{label}</span>
      </div>
      {sub && <div className="mt-1 text-center text-sm text-dim">{sub}</div>}
    </button>
  );
}

/** Cómo se llama cada cosa que sacaste del aula, y qué hace. */
/**
 * Recibe el estado porque los números de una recompensa son los que va a hacer
 * en tu mano, no los de la ficha: si venciste un profesor, el arma que acabás
 * de encontrar pega más de lo que dice su ficha desde el momento en que la
 * agarrás.
 */
function describirBotin(
  state: State,
  b: State["botin"][number],
): {
  nombre: string;
  que: string;
  como: string;
  icono: string[];
  tono: string;
} {
  switch (b.tipo) {
    case "item": {
      const it = ITEMS[b.id];
      return {
        icono: ICONOS_ITEM[b.id],
        tono: tonoItem(b.id),
        nombre: `${it.nombre} (${NOMBRE_RAREZA[it.rareza]})`,
        que: it.efecto.daño
          ? `${it.descripcion} ${dañoDe(state, it.efecto.daño)} de daño.`
          : it.descripcion,
        como: `Se usa desde USAR y no gasta el turno. Se gasta para siempre: acierta ${pctDe(state, it.precision)} de cada 100 veces.`,
      };
    }
    case "arma": {
      const a = ARMAS[b.id];
      return {
        icono: ICONOS_ACCION.arma,
        tono: "text-oro",
        nombre: a.nombre,
        que: `${dañoDe(state, a.daño)} de daño, acierta ${pctDe(state, a.precision)} de cada 100.`,
        como: a.infinita
          ? `No se gasta nunca.${a.perdida ? ` Aunque cada golpe que entra tiene ${Math.round(a.perdida * 100)}% de que la pierdas.` : ""}`
          : `${a.usos} usos por pelea, y se recargan en la siguiente. Pierde puntería con cada golpe.`,
      };
    }
    case "sombra":
      return {
        icono: ICONOS_EFECTO.confusion,
        tono: "text-sueno",
        nombre: `la sombra de ${ENEMIGOS[b.id].nombre}`,
        que: "Te saca los estados que tengas encima.",
        como: "Se usa desde USAR. Es de un solo uso y no vuelve.",
      };
    case "vida":
      return {
        icono: ICONOS_ITEM.venda,
        tono: "text-salud",
        nombre: `${b.cantidad} de vida máxima`,
        que: "Aguantás más en cada pelea, para siempre.",
        como: "No hay que hacer nada: ya está aplicado.",
      };
    case "potencia":
      return {
        icono: ICONOS_ACCION.atacar,
        tono: "text-oro",
        nombre: `${b.cantidad}% más de daño`,
        que: "Todo lo que hacés pega más fuerte: puño, armas, items, bloqueo.",
        como: "Es permanente y se acumula con cada profesor que vencés.",
      };
  }
}

/**
 * La pantalla de los minijuegos. Los tres comparten el marco y cambian sólo lo
 * que hay para elegir: el pizarrón muestra y borra, la apuesta te deja seguir
 * o irte, el examen pregunta.
 */
function Juegito({
  juego,
  dispatch,
}: {
  juego: Minijuego;
  dispatch: (a: Action) => void;
}) {
  // La cuenta regresiva del pizarrón es cosa de la pantalla, no del motor.
  const [mostrando, setMostrando] = useState(juego.tipo === "pizarron");
  useEffect(() => {
    if (juego.tipo !== "pizarron") return;
    const t = setTimeout(() => setMostrando(false), 2600);
    return () => clearTimeout(t);
  }, [juego.tipo]);

  /*
   * Después de apostar, la aguja tiene que llegar a frenar antes de que se
   * pueda apostar de nuevo — y el resultado escrito espera con ella. Si no, el
   * reloj giraría al lado de un texto que ya contó cómo terminó.
   */
  const [girando, setGirando] = useState(false);
  useEffect(() => {
    if (!juego.tirada) return;
    setGirando(true);
    const t = setTimeout(() => setGirando(false), RITMO_TIRADA);
    return () => clearTimeout(t);
  }, [juego.tirada]);

  const elegir = (i: number) => {
    if (girando) return;
    sonar("boton");
    dispatch({ type: "juego", eleccion: i });
  };

  return (
    <section className="entra-pantalla relative flex min-h-0 flex-1 flex-col justify-center gap-6 border border-oro p-6">
      <p className="text-sm tracking-[0.3em] text-oro">
        {juego.tipo === "pizarron"
          ? "EL PIZARRÓN"
          : juego.tipo === "apuesta"
            ? "LA CAJA"
            : "LA HOJA"}
      </p>
      {/* La misma ruleta del combate: toda apuesta del juego se ve girar. */}
      {juego.tipo === "apuesta" && (
        <div className="absolute right-4 top-4">
          <Reloj tirada={girando ? juego.tirada : undefined} />
        </div>
      )}
      <p
        key={juego.cuento + String(juego.juntado)}
        className={`text-base leading-relaxed ${juego.tirada ? "espera-la-aguja" : ""}`}
      >
        {juego.cuento}
      </p>

      {juego.tipo === "pizarron" && (
        <div className="space-y-5">
          {mostrando ? (
            <>
              <p className="text-sm tracking-widest text-dim">MIRALO BIEN</p>
              <div className="flex justify-center gap-3">
                {juego.secuencia!.map((sim, i) => (
                  <Pixeles key={i} data={ICONOS[sim]} clase="w-10 text-agua" />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm tracking-widest text-dim">
                ¿QUÉ DECÍA? — {juego.puestos!.length + 1} de {juego.secuencia!.length}
              </p>
              <div className="flex min-h-12 justify-center gap-3">
                {juego.secuencia!.map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-10 w-10 items-center justify-center border ${
                      juego.puestos![i] ? "border-agua" : "border-borde"
                    }`}
                  >
                    {juego.puestos![i] && (
                      <Pixeles data={ICONOS[juego.puestos![i]]} clase="w-6 text-agua" />
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {juego.opcionesSimbolo!.map((sim, i) => (
                  <button
                    key={sim}
                    onClick={() => elegir(i)}
                    className="flex items-center justify-center border border-borde p-3 hover:border-oro hover:bg-oro/10"
                  >
                    <Pixeles data={ICONOS[sim]} clase="w-6 text-oro" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {juego.tipo === "apuesta" && (
        <div className="space-y-4">
          <p className="text-lg">
            Llevás <span className="text-oro">{juego.juntado}</span>.
          </p>
          <p className="text-sm text-dim">
            Si seguís, {juego.suerte}% de que entre otro y {100 - juego.suerte!}% de
            perder todo lo junto.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Boton
              label="SEGUIR"
              tono="text-oro"
              sub={`${juego.suerte}%`}
              disabled={girando}
              onClick={() => elegir(1)}
            />
            <Boton
              label="ME VOY"
              sub={`con ${juego.juntado}`}
              disabled={girando}
              onClick={() => elegir(0)}
            />
          </div>
        </div>
      )}

      {juego.tipo === "examen" && (
        <div className="space-y-4">
          <p className="text-base">{preguntaDe(juego)}</p>
          <div className="space-y-2">
            {juego.opciones!.map((op, i) => (
              <button
                key={i}
                onClick={() => elegir(i)}
                className="block w-full border border-borde p-3 text-left text-base hover:border-oro hover:bg-oro/10"
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Recompensa({
  state,
  dispatch,
  contando,
}: {
  state: State;
  dispatch: (a: Action) => void;
  contando: boolean;
}) {
  const nueva = state.armaOfrecida;
  return (
    <section className="entra-pantalla flex min-h-0 flex-1 flex-col gap-3 border border-agua-hondo p-4">
      {state.caido && (
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-borde-suave pb-3">
          <EnPie materiaId={state.caido.materiaId} muriendo />
          <p className="text-sm text-dim line-through decoration-malo">
            {ENEMIGOS[state.caido.enemigoId].nombre}
          </p>
        </div>
      )}

      <p className="text-sm tracking-widest text-agua">
        {state.cicloTerminado ? "SE TERMINÓ EL DÍA" : "EL AULA QUEDA VACÍA"}
      </p>

      {/* Lo que sacaste, uno por uno, con qué hace y cómo se usa. */}
      {state.botin.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="text-sm tracking-widest text-dim">TE LLEVÁS</p>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {state.botin.map((b, i) => {
              const d = describirBotin(state, b);
              return (
                <li key={i} className="flex gap-3 border border-borde px-3 py-2.5">
                  <Pixeles data={d.icono} clase={`mt-1 w-5 shrink-0 ${d.tono}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-base ${d.tono}`}>{d.nombre}</span>
                      {b.cantidad > 1 && (
                        <span className="tabular-nums text-agua">×{b.cantidad}</span>
                      )}
                    </div>
                    <p className="text-sm leading-snug text-foreground">{d.que}</p>
                    <p className="text-sm leading-snug text-dim">{d.como}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Mochila llena: no se sale del aula sin decidir qué se deja. */}
      {nueva ? (
        <div className="space-y-2 border-t border-dimmer pt-4">
          <p className="text-sm text-dim">
            Llevás {MAX_ARMAS}. Para agarrar {ARMAS[nueva].nombre} (
            <Golpe state={state} base={ARMAS[nueva].daño} /> de daño ·{" "}
            {pctDe(state, ARMAS[nueva].precision)}% ·{" "}
            {ARMAS[nueva].infinita ? "no se gasta" : `${ARMAS[nueva].usos} usos`}) tenés
            que soltar algo.
          </p>
          {state.jugador.armas.map((id) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "canjear-arma", dejar: id })}
              className="block w-full border border-dimmer p-2 text-left text-sm hover:border-agua"
            >
              soltar {ARMAS[id].nombre} — <Golpe state={state} base={ARMAS[id].daño} /> de
              daño · {Math.round(punteriaArma(state, id) * 100)}% ·{" "}
              {ARMAS[id].infinita ? "no se gasta" : `${ARMAS[id].usos} usos`}
            </button>
          ))}
          <button
            onClick={() => dispatch({ type: "canjear-arma", dejar: null })}
            className="block w-full border border-dimmer p-2 text-left text-sm text-dim hover:border-dim"
          >
            dejarla donde está
          </button>
        </div>
      ) : (
        <button
          onClick={() => dispatch({ type: "seguir" })}
          disabled={contando}
          className="w-full shrink-0 bg-agua p-3 text-sm font-bold tracking-widest text-background hover:opacity-80 disabled:opacity-30"
        >
          {state.cicloTerminado ? "DORMIR" : "VOLVER AL PASILLO"}
        </button>
      )}
    </section>
  );
}

// --- el sueño: el único lugar que tiene sentido ---------------------------

function Sueño({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  return (
    <section className="entra-pantalla -mx-5 -my-8 min-h-screen bg-[#e8eeeb] px-6 py-12 text-[#1a2b28]">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-sm tracking-[0.3em] text-[#4a625d]">POR FIN</p>
          <p className="text-sm leading-relaxed">
            Todo está en orden. Las cosas tienen el tamaño que les corresponde y
            nada te está mirando. Alguien dejó tres cosas sobre el banco.
          </p>
        </div>

        <div className="space-y-3">
          {state.oferta.map((par, i) => {
            const poder = PODERES[par.poderId];
            const defecto = DEFECTOS[par.defectoId];
            return (
              <button
                key={i}
                onClick={() => dispatch({ type: "aceptar-oferta", index: i })}
                className="w-full border border-[#b9c7c2] bg-white p-4 text-left transition-colors hover:border-[#1a2b28]"
              >
                <div className="text-sm font-bold">{poder.nombre}</div>
                <p className="mt-1 text-sm text-[#4a625d]">{poder.texto}</p>
                <div className="mt-3 border-t border-[#dde5e2] pt-3">
                  <div className="text-sm font-bold text-[#93402f]">{defecto.nombre}</div>
                  <p className="mt-1 text-sm text-[#4a625d]">{defecto.texto}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-sm text-[#5f6d69]">
          Vas a tener que despertarte igual.
        </p>
      </div>
    </section>
  );
}

// --- final ----------------------------------------------------------------

/**
 * El final, contado como una historia y no como un cartel.
 *
 * Antes decía hasta dónde llegaste y nada más. Una run que no deja nada atrás
 * no da ganas de empezar otra: lo que hace apretar OTRA VEZ no es el botón sino
 * acordarte de algo puntual —quién te mató, cuánto te faltaba, lo que tenías en
 * el bolsillo y no usaste—.
 *
 * Esa última línea es a propósito la más incómoda. Morirte con tres items
 * guardados es la lección más útil que da el juego, y sólo se aprende si te la
 * dicen en la cara.
 */
/**
 * De qué materia es un enemigo. Al morir el combate ya no existe —el motor lo
 * limpia— así que la única forma de dibujar al que te alcanzó es volver a
 * buscarlo por su id.
 */
function materiaDe(enemigoId: string): string {
  if (enemigoId.startsWith("prof_")) return enemigoId.slice(5);
  const m = Object.values(MATERIAS).find((x) => x.enemigos.includes(enemigoId));
  return m?.id ?? "biologia";
}

function Final({ state, onRestart }: { state: State; onRestart: () => void }) {
  const muerto = state.fase === "muerto";
  const j = state.jugador;
  const guardados = j.items.length + j.sombras.length;
  return (
    <section className={`entra-pantalla space-y-5 border p-6 ${muerto ? "border-malo" : "border-agua"}`}>
      <p className={`text-sm tracking-widest ${muerto ? "text-malo" : "text-agua"}`}>
        {muerto ? "NO SONÓ NINGÚN TIMBRE" : "SALISTE"}
      </p>
      <p className="text-sm leading-relaxed">{state.final}</p>

      {muerto && state.matador && (
        <div className="flex items-center gap-4 border-y border-borde-suave py-4">
          <EnPie materiaId={materiaDe(state.matador)} />
          <div className="min-w-0">
            <p className="text-xs tracking-[0.35em] text-dim">TE ALCANZÓ</p>
            <p className="text-lg leading-tight text-malo">
              {ENEMIGOS[state.matador].nombre}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1 border-t border-dimmer pt-4 text-sm text-dim">
        <p>
          Ciclo <span className="tabular-nums text-foreground">{state.ciclo}</span> de {CICLOS} ·{" "}
          <span className="tabular-nums text-foreground">{state.profesoresVencidos}</span>{" "}
          {state.profesoresVencidos === 1 ? "profesor vencido" : "profesores vencidos"}
        </p>
        <p>
          Abriste <span className="tabular-nums text-foreground">{state.aulasHechas}</span>{" "}
          {state.aulasHechas === 1 ? "aula" : "aulas"}.
        </p>
        {muerto && guardados > 0 && (
          <p className="text-oro">
            Te quedaban <span className="tabular-nums">{guardados}</span>{" "}
            {guardados === 1 ? "cosa" : "cosas"} sin usar.
          </p>
        )}
        {state.jugador.defectos.length > 0 && (
          <p>Te llevaste: {state.jugador.defectos.map((d) => DEFECTOS[d].nombre).join(", ")}.</p>
        )}
      </div>
      <button
        onClick={onRestart}
        className="w-full bg-agua p-3 text-sm font-bold tracking-widest text-background hover:opacity-80"
      >
        OTRA VEZ
      </button>
    </section>
  );
}

/** Lo que cura se pinta de verde, sea de la rareza que sea. */
function tonoItem(id: string): string {
  return ITEMS[id].efecto.vida ? "text-salud" : COLOR_RAREZA[ITEMS[id].rareza];
}

/** La rareza se lee de un vistazo por el color. */
const COLOR_RAREZA: Record<string, string> = {
  comun: "text-dim",
  raro: "text-oro",
  unico: "text-sueno",
};
const NOMBRE_RAREZA: Record<string, string> = {
  comun: "común",
  raro: "raro",
  unico: "único",
};

const COLOR = {
  neutral: "text-dim",
  bueno: "text-agua",
  malo: "text-malo",
  sueño: "text-sueno",
  enemigo: "text-foreground",
} as const;

/** Los mismos tonos, pero para el evento que ocupa la pantalla. */
const COLOR_FUERTE = {
  neutral: "text-foreground",
  bueno: "text-agua",
  malo: "text-malo",
  sueño: "text-sueno",
  enemigo: "text-foreground",
} as const;

function Bitacora({ state }: { state: State }) {
  return (
    <section className="space-y-1 border-t border-dimmer pt-4">
      {state.log.slice(0, 4).map((e, i) => (
        <p
          key={`${i}-${e.texto}`}
          className={`text-sm leading-relaxed ${COLOR[e.tipo]}`}
          style={{ opacity: Math.max(0.3, 1 - i * 0.18) }}
        >
          {e.texto}
        </p>
      ))}
    </section>
  );
}
