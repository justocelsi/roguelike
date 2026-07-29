"use client";

import { useEffect, useRef, useState } from "react";
import { ARMAS, ENEMIGOS, EXPLICACION_EFECTO, ITEMS } from "@/game/content";
import {
  CICLOS,
  confundido,
  DAÑO_ATAQUE,
  DAÑO_CONTRA,
  EFECTIVIDAD_BLOQUEO,
  armasUsables,
  factorMiedo,
  initialState,
  MAX_ARMAS,
  nombreDe,
  PRECISION_ATAQUE,
  precisionArma,
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
import { DEFECTOS, PODERES } from "@/game/poderes";
import { ICONOS, ICONOS_EFECTO, SPRITES } from "@/game/sprites";
import type { Accion, Action, Entrada, Intencion, State } from "@/game/types";

/** Cuánto dura un evento común en pantalla. */
const RITMO = 700;
/** El último evento de una mano se queda más: es el turno cambiando de lado. */
const RITMO_TURNO = 1100;
/** El aviso del enemigo: es lo único que hay que leer para decidir. */
const RITMO_AVISO = 1900;

const SIN_LOG: Entrada[] = [];

export default function Juego() {
  const [state, setState] = useState<State | null>(null);
  const dispatch = (a: Action) => setState((s) => (s ? reduce(s, a) : s));
  // La posición vive acá arriba para que entrar y salir de un aula no te
  // teletransporte al principio del pasillo.
  const pos = useRef<{ x: number; y: number } | null>(null);
  const cicloAnterior = useRef(1);
  // La secuencia también vive acá: el golpe que mata cambia de pantalla, y
  // esas líneas tienen que terminar de verse igual.
  const { actual, contando, restantes } = useSecuencia(state?.log ?? SIN_LOG);

  if (!state) {
    return (
      <Portada
        onStart={() => {
          pos.current = null;
          setState(initialState());
        }}
      />
    );
  }

  if (state.ciclo !== cicloAnterior.current) {
    cicloAnterior.current = state.ciclo;
    pos.current = null;
  }

  // Sólo los estados frenan la pantalla entera; el resto va en línea.
  const evento =
    actual?.icono ? <EventoEfecto entrada={actual} k={restantes} /> : null;

  if (state.fase === "pasillo" && state.mundo) {
    return (
      <>
        {evento}
        <Pasillo
          state={state}
          mundo={state.mundo}
          pos={pos}
          onEntrar={(p) => dispatch({ type: "entrar-aula", puertaX: p.x, puertaY: p.y })}
        />
      </>
    );
  }

  return (
    <>
      {evento}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-8">
        {state.fase !== "sueño" && (
          <Cabecera state={state} vidaMostrada={actual?.vidaJugador} />
        )}
        {state.fase === "combate" && (
          <Combate
            state={state}
            dispatch={dispatch}
            contando={contando}
            actual={actual}
            restantes={restantes}
          />
        )}
        {state.fase === "recompensa" && (
          <Recompensa state={state} dispatch={dispatch} contando={contando} />
        )}
        {state.fase === "sueño" && <Sueño state={state} dispatch={dispatch} />}
        {(state.fase === "muerto" || state.fase === "fin") && (
          <Final
            state={state}
            onRestart={() => {
              pos.current = null;
              setState(initialState());
            }}
          />
        )}
      </main>
    </>
  );
}

// --- portada --------------------------------------------------------------

function Portada({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="space-y-5 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-agua">VIGILIA</h1>
        <p className="text-sm leading-relaxed text-dim">
          Hace tres días que no dormís bien.
          <br />
          Ya no estás seguro de cuál de los dos mundos te espera despierto.
        </p>
      </div>
      <Sprite materiaId="biologia" clase="respira" />
      <button
        onClick={onStart}
        className="w-full bg-agua px-8 py-4 text-sm font-bold tracking-[0.2em] text-background transition-opacity hover:opacity-80"
      >
        ENTRAR
      </button>
    </main>
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
  data.forEach((fila, gy) =>
    fila.split("").forEach((ch, gx) => {
      if (ch === "#") ctx.fillRect(x + gx * px, y + gy * px, px, px);
    }),
  );
}

function Pasillo({
  state,
  mundo,
  pos,
  onEntrar,
}: {
  state: State;
  mundo: Mundo;
  pos: React.RefObject<{ x: number; y: number } | null>;
  onEntrar: (p: Puerta) => void;
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

      // Piso del pasillo y aulas de fondo.
      for (let ty = 0; ty < mundo.alto; ty++) {
        for (let tx = 0; tx < mundo.ancho; tx++) {
          const t = tileEn(mundo, tx, ty);
          if (t === PISO) {
            ctx.fillStyle = "#0d1f1c";
            ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
            ctx.fillStyle = "#122a26";
            ctx.fillRect(tx * TILE, ty * TILE + TILE - 1, TILE, 1);
          } else if (t === SALA) {
            // El aula se ve a través de la pared, apagada.
            ctx.fillStyle = ty % 2 === 0 ? "#091613" : "#0a1815";
            ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
          }
        }
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

      ctx.fillStyle = "#cfe3de";
      ctx.fillRect(p.x - CUERPO / 2, p.y - CUERPO / 2, CUERPO, CUERPO);
      ctx.fillStyle = "#3fd9c4";
      ctx.fillRect(p.x - 2 + mirando.x * 3, p.y - 2 + mirando.y * 3, 4, 3);

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-8">
      <Cabecera state={state} />

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
            className="absolute right-3 top-3 rounded-full bg-agua px-5 py-3 text-sm font-bold tracking-widest text-background md:hidden"
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
                      ? ENEMIGOS[cerca.sorteado].nombre
                      : nombreDe(state, cerca.materiaId)}
                  </span>
                  <span className="text-sm text-dim">[E] entrar</span>
                </div>
                {!cerca.profesor && (
                  <ul className="mt-1 flex flex-wrap gap-x-4">
                    {cerca.lecturas.map((l) => (
                      <li key={l.enemigoId} className="text-sm text-dim">
                        <span className="tabular-nums text-foreground">
                          {num(l.prob * 100, c)}%
                        </span>{" "}
                        {ENEMIGOS[l.enemigoId].nombre}
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

/** Dibuja una grilla de texto como bloques. Toma el color de currentColor. */
function Pixeles({ data, clase = "" }: { data: string[]; clase?: string }) {
  const cols = data[0].length;
  return (
    <div
      className={`grid ${clase}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-hidden
    >
      {data.flatMap((fila, y) =>
        fila.split("").map((ch, x) => (
          <div
            key={`${x}-${y}`}
            className="aspect-square"
            style={{ background: ch === "#" ? "currentColor" : "transparent" }}
          />
        )),
      )}
    </div>
  );
}

function Sprite({ materiaId, clase = "" }: { materiaId: string; clase?: string }) {
  return (
    <Pixeles
      data={SPRITES[materiaId] ?? SPRITES.matematica}
      clase={`w-40 text-agua ${clase}`}
    />
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
    <span className="group relative inline-block">
      <span
        tabIndex={0}
        title={explicacion}
        className={`flex cursor-help items-center gap-1.5 px-2.5 py-1 ${clase}`}
      >
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-64 border border-agua bg-background p-3 text-sm leading-snug text-foreground shadow-lg group-hover:block group-focus-within:block"
      >
        {explicacion}
      </span>
    </span>
  );
}

/** Cuántos usos mostrar de un arma: ∞ para las que no se gastan. */
function usosTexto(state: State, id: string): string {
  if (ARMAS[id].infinita) return "∞";
  return String(state.combate ? usosArma(state, id) : ARMAS[id].usos);
}

function Cabecera({ state, vidaMostrada }: { state: State; vidaMostrada?: number }) {
  const j = state.jugador;
  const c = confundido(state);
  const vida = vidaMostrada ?? j.vida;
  return (
    <header className="space-y-2">
      <div className="flex items-baseline justify-between text-sm tracking-widest text-dim">
        <span className="text-agua">
          CICLO {state.ciclo}/{CICLOS}
        </span>
        <span>
          {j.armas.length
            ? j.armas.map((id) => `${ARMAS[id].nombre} ×${usosTexto(state, id)}`).join(" · ")
            : "con las manos"}
        </span>
      </div>
      <Barra valor={vida} max={j.vidaMax} />
      <div className="flex justify-between text-sm text-dim">
        <span className="tabular-nums">
          {num(vida, c)}/{num(j.vidaMax, c)}
        </span>
        <span>{j.items.length + j.sombras.length} en el bolsillo</span>
      </div>
      {/* Se apilan y se envuelven: si te agarran dos cosas, se ven las dos. */}
      {(state.efectos.length > 0 || j.defectos.length > 0) && (
        <div className="flex flex-wrap items-start gap-2 text-sm">
          {state.efectos.map((e) => (
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
function useSecuencia(log: Entrada[]) {
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
        // El último evento de una mano se queda más tiempo: ese silencio es
        // el turno pasando de un lado al otro.
        const siguiente = cronologico[k + 1];
        const cambiaDeManos =
          !!siguiente && (siguiente.actor ?? "vos") !== (entrada.actor ?? "vos");
        return { entrada, dura: cambiaDeManos ? RITMO_TURNO : RITMO };
      }),
    );
  }, [log]);

  useEffect(() => {
    if (cola.length === 0) {
      setActual(null);
      return;
    }
    const [primero, ...resto] = cola;
    setActual(primero.entrada);
    const t = setTimeout(() => setCola(resto), primero.dura);
    return () => clearTimeout(t);
  }, [cola]);

  return { actual, contando: cola.length > 0, restantes: cola.length };
}

/**
 * El oscurecido de toda la pantalla queda reservado para cuando te agarra un
 * estado: es lo bastante grave como para frenar todo. El resto de los eventos
 * se muestran en línea, sin tapar el combate.
 */
function EventoEfecto({ entrada, k }: { entrada: Entrada; k: number }) {
  if (!entrada.icono) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-8">
      <div
        key={`${k}-${entrada.texto}`}
        className="aparece flex max-w-sm flex-col items-center gap-4 text-center"
      >
        <Pixeles data={ICONOS_EFECTO[entrada.icono]} clase="w-16 text-malo" />
        <p className="text-lg leading-snug text-malo">{entrada.texto}</p>
      </div>
    </div>
  );
}

/** El detalle numérico de lo que el enemigo va a intentar. */
function numerosDe(i: Intencion): string {
  const prob = `${Math.round((i.precision ?? 0.85) * 100)}% de acertar`;
  if (i.tipo === "golpe") return `golpe de ~${Math.round((i.daño ?? 0) * 1.15)} · ${prob}`;
  if (i.tipo === "efecto") {
    return `te deja ${(NOMBRE_EFECTO[i.efecto ?? ""] ?? "").toLowerCase()} · ${prob}`;
  }
  return "no hace nada este turno";
}

/** Un evento por vez, en el lugar donde vive el combate. */
function EventoEnLinea({
  entrada,
  k,
  numeros,
}: {
  entrada: Entrada;
  k: number;
  numeros?: string;
}) {
  return (
    <div
      key={`${k}-${entrada.texto}`}
      className={`aparece flex min-h-20 flex-col justify-center gap-1.5 border-l-2 px-4 py-3 ${
        entrada.aviso ? "border-agua bg-agua/5" : "border-agua-hondo"
      }`}
    >
      <span className="text-xs tracking-[0.35em] text-dim">
        {entrada.aviso
          ? "SE DECIDE"
          : (entrada.actor ?? "vos") === "vos"
            ? "VOS"
            : "ESO"}
      </span>
      <p className={`text-base leading-snug ${COLOR_FUERTE[entrada.tipo]}`}>
        {entrada.texto}
      </p>
      {/* El número va pegado abajo del texto que lo describe en abstracto. */}
      {entrada.aviso && numeros && <p className="text-sm text-dim">{numeros}</p>}
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

  if (!c) return null;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  const conf = confundido(state);
  const j = state.jugador;
  // Con miedo encima, lo que vale es el producto de las dos tiradas.
  const miedo = factorMiedo(state);
  const pct = (p: number) => Math.round(p * miedo * 100);

  const act = (accion: Accion, ref?: string) => {
    if (contando) return;
    setMenu(null);
    dispatch({ type: "combate", accion, ref });
  };

  const vidaEnemigo = vidaEnemigoVista ?? c.vida;

  const guardado = [
    ...j.items.map((id, i) => ({
      ref: id,
      key: `i${i}`,
      texto: `${ITEMS[id].nombre} · ${pct(ITEMS[id].precision)}% — ${ITEMS[id].descripcion}`,
      clase: "text-dim",
    })),
    ...j.sombras.map((id, i) => ({
      ref: `sombra:${id}`,
      key: `s${i}`,
      texto: `sombra de ${ENEMIGOS[id].nombre} — te saca los efectos`,
      clase: "text-sueno",
    })),
    ...j.poderes
      .filter((id) => usosPoder(state, id) > 0)
      .map((id) => ({
        ref: `poder:${id}`,
        key: id,
        texto: `${PODERES[id].nombre} ×${usosPoder(state, id)} · ${pct(PODERES[id].precision)}% — ${PODERES[id].texto}`,
        clase: "text-agua",
      })),
  ];

  const usables = armasUsables(state);

  return (
    <section className="space-y-4">
      {/* Destello en toda la pantalla: te entró. */}
      {herido > 0 && (
        <div
          key={`destello-${herido}`}
          className="destello pointer-events-none fixed inset-0 z-50"
        />
      )}

      <div
        key={`herido-${herido}`}
        className={`flex flex-col items-center gap-3 border p-5 ${
          enemigo.profesor ? "border-malo" : "border-dimmer"
        } ${herido > 0 ? "sacude" : ""}`}
      >
        <div key={`golpe-${golpe}`} className={golpe > 0 ? "sacude" : "respira"}>
          <Sprite materiaId={c.materiaId} />
        </div>
        <p className="text-center text-sm">{enemigo.nombre}</p>
        <div className="w-full space-y-1">
          <Barra valor={vidaEnemigo} max={c.vidaMax} color="bg-malo" />
          <div className="text-right text-sm tabular-nums text-dim">
            {num(vidaEnemigo, conf)}/{num(c.vidaMax, conf)}
          </div>
        </div>
      </div>

      {/* Un evento por vez, arriba de los botones. Cuando no pasa nada, el
          aviso vigente queda a la vista para poder decidir. */}
      {actual && !actual.icono ? (
        <EventoEnLinea entrada={actual} k={restantes} numeros={numerosDe(intencion)} />
      ) : (
        <div className="flex min-h-20 flex-col justify-center gap-1.5 border-l-2 border-agua px-4 py-3">
          <span className="text-xs tracking-[0.35em] text-dim">VA A HACER</span>
          <p className="text-base leading-snug text-agua">{intencion.tell}</p>
          <p className="text-sm text-dim">{numerosDe(intencion)}</p>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2 ${contando ? "pointer-events-none opacity-40" : ""}`}>
        <Boton
          label="ATACAR"
          sub={`${DAÑO_ATAQUE} · ${pct(PRECISION_ATAQUE)}%`}
          onClick={() => act("atacar")}
        />
        <Boton
          label="BLOQUEAR"
          sub={`para el golpe y devolvés ${DAÑO_CONTRA} · ${Math.round(EFECTIVIDAD_BLOQUEO * 100)}%`}
          onClick={() => act("bloquear")}
        />
        <Boton
          label={usables.length ? "ARMA" : "SIN ARMA"}
          sub={usables.length ? `${usables.length} a mano` : "—"}
          disabled={usables.length === 0}
          onClick={() => setMenu(menu === "armas" ? null : "armas")}
        />
        <Boton
          label="USAR"
          sub={`${guardado.length}`}
          disabled={guardado.length === 0}
          onClick={() => setMenu(menu === "usar" ? null : "usar")}
        />
      </div>

      {menu === "armas" && !contando && (
        <div className="space-y-1 border border-dimmer p-3">
          {usables.map((id) => (
            <button
              key={id}
              onClick={() => act("arma", id)}
              className="block w-full text-left text-sm text-foreground hover:text-agua"
            >
              {ARMAS[id].nombre} — {ARMAS[id].daño} de daño ·{" "}
              {pct(precisionArma(state, id))}% · {usosTexto(state, id)} usos
              {ARMAS[id].critico > 0 && ` · ${Math.round(ARMAS[id].critico * 100)}% crítico`}
            </button>
          ))}
        </div>
      )}

      {menu === "usar" && !contando && (
        <div className="space-y-1 border border-dimmer p-3">
          {guardado.map((g) => (
            <button
              key={g.key}
              onClick={() => act("usar", g.ref)}
              className={`block w-full text-left text-sm hover:text-foreground ${g.clase}`}
            >
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
  disabled,
  onClick,
}: {
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="border border-dimmer p-3 text-center transition-colors hover:border-agua disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-dimmer"
    >
      <div className="truncate text-sm font-bold">{label}</div>
      {sub && <div className="mt-0.5 text-sm text-dim">{sub}</div>}
    </button>
  );
}

/** Cómo se llama cada cosa que sacaste del aula. */
function nombreBotin(b: State["botin"][number]): string {
  switch (b.tipo) {
    case "item":
      return ITEMS[b.id].nombre;
    case "arma":
      return ARMAS[b.id].nombre;
    case "sombra":
      return `la sombra de ${ENEMIGOS[b.id].nombre}`;
    case "vida":
      return `${b.cantidad} de vida máxima`;
  }
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
    <section className="space-y-4 border border-agua-hondo p-5">
      <p className="text-sm tracking-widest text-agua">
        {state.cicloTerminado ? "SE TERMINÓ EL DÍA" : "EL AULA QUEDA VACÍA"}
      </p>

      {/* Lo que sacaste, uno por uno y con cantidad. */}
      {state.botin.length > 0 && (
        <ul className="space-y-1.5 border-y border-borde-suave py-3">
          {state.botin.map((b, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <span className="text-agua">+</span>
              <span className="text-foreground">{nombreBotin(b)}</span>
              {b.cantidad > 1 && (
                <span className="tabular-nums text-dim">×{b.cantidad}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Mochila llena: no se sale del aula sin decidir qué se deja. */}
      {nueva ? (
        <div className="space-y-2 border-t border-dimmer pt-4">
          <p className="text-sm text-dim">
            Llevás {MAX_ARMAS}. Para agarrar {ARMAS[nueva].nombre} ({ARMAS[nueva].daño} de
            daño · {Math.round(ARMAS[nueva].precision * 100)}% ·{" "}
            {ARMAS[nueva].infinita ? "no se gasta" : `${ARMAS[nueva].usos} usos`}) tenés
            que soltar algo.
          </p>
          {state.jugador.armas.map((id) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "canjear-arma", dejar: id })}
              className="block w-full border border-dimmer p-2 text-left text-sm hover:border-agua"
            >
              soltar {ARMAS[id].nombre} — {ARMAS[id].daño} de daño ·{" "}
              {Math.round(ARMAS[id].precision * 100)}% ·{" "}
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
          className="w-full bg-agua p-3 text-sm font-bold tracking-widest text-background hover:opacity-80 disabled:opacity-30"
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
    <section className="-mx-5 -my-8 min-h-screen bg-[#e8eeeb] px-6 py-12 text-[#1a2b28]">
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

function Final({ state, onRestart }: { state: State; onRestart: () => void }) {
  const muerto = state.fase === "muerto";
  return (
    <section className={`space-y-5 border p-6 ${muerto ? "border-malo" : "border-agua"}`}>
      <p className={`text-sm tracking-widest ${muerto ? "text-malo" : "text-agua"}`}>
        {muerto ? "NO SONÓ NINGÚN TIMBRE" : "SALISTE"}
      </p>
      <p className="text-sm leading-relaxed">{state.final}</p>
      <div className="space-y-1 border-t border-dimmer pt-4 text-sm text-dim">
        <p>
          Llegaste al ciclo {state.ciclo} de {CICLOS}.
        </p>
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
