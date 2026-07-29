"use client";

import { useEffect, useRef, useState } from "react";
import { ARMAS, ENEMIGOS, ITEMS, MATERIAS } from "@/game/content";
import {
  CICLOS,
  confundido,
  DAÑO_ATAQUE,
  initialState,
  nombreDe,
  puedeHuir,
  reduce,
} from "@/game/engine";
import {
  CUERPO,
  PISO,
  PUERTA,
  TILE,
  VELOCIDAD,
  mover,
  puertaCerca,
  tileEn,
  type Mundo,
  type Puerta,
} from "@/game/mundo";
import { DEFECTOS, PODERES } from "@/game/poderes";
import { SPRITES } from "@/game/sprites";
import type { Accion, Action, State } from "@/game/types";

export default function Juego() {
  const [state, setState] = useState<State | null>(null);
  const dispatch = (a: Action) => setState((s) => (s ? reduce(s, a) : s));
  // La posición vive acá arriba para que entrar y salir de un aula no te
  // teletransporte al principio del pasillo.
  const pos = useRef<{ x: number; y: number } | null>(null);
  const cicloAnterior = useRef(1);

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

  if (state.fase === "pasillo" && state.mundo) {
    return (
      <Pasillo
        state={state}
        mundo={state.mundo}
        pos={pos}
        onEntrar={(p) =>
          dispatch({ type: "entrar-aula", puertaX: p.x, puertaY: p.y })
        }
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-8">
      {state.fase !== "sueño" && <Cabecera state={state} />}
      {state.fase === "combate" && <Combate state={state} dispatch={dispatch} />}
      {state.fase === "recompensa" && (
        <Recompensa state={state} dispatch={dispatch} />
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
          Ya no estás seguro de cuál de los dos mundos es el que te espera
          despierto.
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
      if (dx || dy) {
        const largo = Math.hypot(dx, dy);
        const nueva = mover(mundo, p, (dx / largo) * VELOCIDAD * dt, (dy / largo) * VELOCIDAD * dt);
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

      for (let ty = 0; ty < mundo.alto; ty++) {
        for (let tx = 0; tx < mundo.ancho; tx++) {
          const t = tileEn(mundo, tx, ty);
          if (t === PISO) {
            ctx.fillStyle = "#0d1f1c";
            ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
            ctx.fillStyle = "#122a26";
            ctx.fillRect(tx * TILE, ty * TILE + TILE - 1, TILE, 1);
          } else if (t === PUERTA) {
            const pu = mundo.puertas.find((q) => q.x === tx && q.y === ty);
            const usada = pu?.usada;
            ctx.fillStyle = usada ? "#12332e" : pu?.profesor ? "#8a3b33" : "#1c6b60";
            ctx.fillRect(tx * TILE + 2, ty * TILE + 3, TILE - 4, TILE - 3);
            ctx.fillStyle = usada ? "#1c3f39" : pu?.profesor ? "#e2685c" : "#3fd9c4";
            ctx.fillRect(tx * TILE + 2, ty * TILE + 3, TILE - 4, 2);
          }
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

      <div className="relative border border-dimmer">
        <canvas
          ref={canvasRef}
          width={720}
          height={340}
          className="w-full"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Lo que hay detrás de la puerta se lee al pararte enfrente. */}
        {cerca && (
          <div className="absolute inset-x-0 bottom-0 border-t border-agua bg-background/95 p-3">
            {cerca.usada ? (
              <p className="text-center text-xs text-dim">Ya entraste acá.</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-bold ${cerca.profesor ? "text-malo" : "text-agua"}`}>
                    {cerca.profesor
                      ? ENEMIGOS[cerca.sorteado].nombre
                      : nombreDe(state, cerca.materiaId)}
                  </span>
                  <span className="text-xs text-dim">[E] entrar</span>
                </div>
                {!cerca.profesor && (
                  <ul className="mt-1 flex flex-wrap gap-x-4">
                    {cerca.lecturas.map((l) => (
                      <li key={l.enemigoId} className="text-xs text-dim">
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

      <p className="text-xs text-dim">
        WASD o flechas · [E] para entrar · el fondo del pasillo es el profesor
      </p>
      <Bitacora state={state} />
    </main>
  );
}

// --- piezas ---------------------------------------------------------------

function Sprite({ materiaId, clase = "" }: { materiaId: string; clase?: string }) {
  const data = SPRITES[materiaId] ?? SPRITES.matematica;
  const cols = data[0].length;
  return (
    <div
      className={`grid w-40 text-agua ${clase}`}
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

function Barra({ valor, max, color = "bg-agua" }: { valor: number; max: number; color?: string }) {
  const bloques = 24;
  const llenos = Math.max(0, Math.round((valor / max) * bloques));
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

function Cabecera({ state }: { state: State }) {
  const j = state.jugador;
  const c = confundido(state);
  return (
    <header className="space-y-2">
      <div className="flex items-baseline justify-between text-xs tracking-widest text-dim">
        <span className="text-agua">
          CICLO {state.ciclo}/{CICLOS}
        </span>
        <span>
          {j.armaId ? `${ARMAS[j.armaId].nombre} ×${j.armaUsos}` : "sin arma"}
        </span>
      </div>
      <Barra valor={j.vida} max={j.vidaMax} />
      <div className="flex justify-between text-xs text-dim">
        <span className="tabular-nums">
          {num(j.vida, c)}/{num(j.vidaMax, c)}
        </span>
        <span>{j.items.length + j.sombras.length} en el bolsillo</span>
      </div>
      {(state.efectos.length > 0 || j.defectos.length > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {state.efectos.map((e) => (
            <span key={e.efecto} className="bg-malo px-2 py-0.5 text-background">
              {NOMBRE_EFECTO[e.efecto]} {e.turnos}
            </span>
          ))}
          {j.defectos.map((d) => (
            <span key={d} className="border border-sueno px-2 py-0.5 text-sueno">
              {DEFECTOS[d].nombre}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

// --- combate --------------------------------------------------------------

function Combate({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [menu, setMenu] = useState(false);
  const c = state.combate;
  if (!c) return null;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  const conf = confundido(state);
  const j = state.jugador;

  const act = (accion: Accion, ref?: string) => {
    setMenu(false);
    dispatch({ type: "combate", accion, ref });
  };

  const guardado = [
    ...j.items.map((id, i) => ({ ref: id, key: `i${i}`, texto: `${ITEMS[id].nombre} — ${ITEMS[id].descripcion}`, clase: "text-dim" })),
    ...j.sombras.map((id, i) => ({ ref: `sombra:${id}`, key: `s${i}`, texto: `sombra de ${ENEMIGOS[id].nombre} — te saca los efectos`, clase: "text-sueno" })),
    ...j.poderes.filter((p) => p.usos > 0).map((p) => ({ ref: `poder:${p.id}`, key: p.id, texto: `${PODERES[p.id].nombre} ×${p.usos} — ${PODERES[p.id].texto}`, clase: "text-agua" })),
  ];

  return (
    <section className="space-y-4">
      <div className={`flex flex-col items-center gap-3 border p-5 ${enemigo.profesor ? "border-malo" : "border-dimmer"}`}>
        <Sprite materiaId={c.materiaId} clase="respira" />
        <p className="text-center text-sm">{enemigo.nombre}</p>
        <div className="w-full space-y-1">
          <Barra valor={c.vida} max={c.vidaMax} color="bg-malo" />
          <div className="text-right text-xs tabular-nums text-dim">
            {num(c.vida, conf)}/{num(c.vidaMax, conf)}
          </div>
        </div>
        <p className="w-full border-t border-dimmer pt-3 text-center text-sm text-agua">
          {intencion.tell}
        </p>
      </div>

      {/* Lo que acaba de pasar, pegado arriba de los botones. */}
      <div className="min-h-14 space-y-0.5 border-l-2 border-agua-hondo pl-3">
        {state.log.slice(0, 3).map((e, i) => (
          <p
            key={`${i}-${e.texto}`}
            className={`text-xs leading-snug ${COLOR[e.tipo]}`}
            style={{ opacity: i === 0 ? 1 : 0.45 - i * 0.1 }}
          >
            {e.texto}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Boton label="ATACAR" sub={`${DAÑO_ATAQUE}`} onClick={() => act("atacar")} />
        <Boton label="ESPERAR" sub="te cubrís" onClick={() => act("esperar")} />
        <Boton
          label={j.armaId ? ARMAS[j.armaId].nombre.toUpperCase() : "SIN ARMA"}
          sub={j.armaId ? `${ARMAS[j.armaId].daño} · quedan ${j.armaUsos}` : "—"}
          disabled={!j.armaId || j.armaUsos <= 0}
          onClick={() => act("arma")}
        />
        <Boton
          label="USAR"
          sub={`${guardado.length}`}
          disabled={guardado.length === 0}
          onClick={() => setMenu(!menu)}
        />
      </div>

      {menu && (
        <div className="space-y-1 border border-dimmer p-3">
          {guardado.map((g) => (
            <button
              key={g.key}
              onClick={() => act("usar", g.ref)}
              className={`block w-full text-left text-xs hover:text-foreground ${g.clase}`}
            >
              {g.texto}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => act("huir")}
        disabled={!puedeHuir(state)}
        className="w-full border border-dimmer p-2 text-xs tracking-widest text-dim hover:border-dim disabled:opacity-25"
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
      <div className="truncate text-xs font-bold">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-dim">{sub}</div>}
    </button>
  );
}

function Recompensa({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  return (
    <section className="space-y-4 border border-agua-hondo p-5">
      <p className="text-xs tracking-widest text-agua">
        {state.cicloTerminado ? "SE TERMINÓ EL DÍA" : "EL AULA QUEDA VACÍA"}
      </p>
      {state.log.slice(0, 3).map((e, i) => (
        <p key={i} className={`text-xs ${COLOR[e.tipo]}`}>
          {e.texto}
        </p>
      ))}
      <button
        onClick={() => dispatch({ type: "seguir" })}
        className="w-full bg-agua p-3 text-xs font-bold tracking-widest text-background hover:opacity-80"
      >
        {state.cicloTerminado ? "DORMIR" : "VOLVER AL PASILLO"}
      </button>
    </section>
  );
}

// --- el sueño: el único lugar que tiene sentido ---------------------------

function Sueño({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  return (
    <section className="-mx-5 -my-8 min-h-screen bg-[#e8eeeb] px-6 py-12 text-[#1a2b28]">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs tracking-[0.3em] text-[#4a625d]">POR FIN</p>
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
                <p className="mt-1 text-xs text-[#4a625d]">{poder.texto}</p>
                <div className="mt-3 border-t border-[#dde5e2] pt-3">
                  <div className="text-xs font-bold text-[#a8443a]">
                    {defecto.nombre}
                  </div>
                  <p className="mt-1 text-xs text-[#4a625d]">{defecto.texto}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-[#8a9793]">
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
      <p className={`text-xs tracking-widest ${muerto ? "text-malo" : "text-agua"}`}>
        {muerto ? "NO SONÓ NINGÚN TIMBRE" : "SALISTE"}
      </p>
      <p className="text-sm leading-relaxed">{state.final}</p>
      <div className="space-y-1 border-t border-dimmer pt-4 text-xs text-dim">
        <p>Llegaste al ciclo {state.ciclo} de {CICLOS}.</p>
        {state.jugador.defectos.length > 0 && (
          <p>Te llevaste: {state.jugador.defectos.map((d) => DEFECTOS[d].nombre).join(", ")}.</p>
        )}
      </div>
      <button
        onClick={onRestart}
        className="w-full bg-agua p-3 text-xs font-bold tracking-widest text-background hover:opacity-80"
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

function Bitacora({ state }: { state: State }) {
  return (
    <section className="space-y-1 border-t border-dimmer pt-4">
      {state.log.slice(0, 4).map((e, i) => (
        <p
          key={`${i}-${e.texto}`}
          className={`text-xs leading-relaxed ${COLOR[e.tipo]}`}
          style={{ opacity: Math.max(0.3, 1 - i * 0.18) }}
        >
          {e.texto}
        </p>
      ))}
    </section>
  );
}
