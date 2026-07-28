"use client";

import { useState } from "react";
import { ARMAS, ENEMIGOS, ITEMS, MATERIAS } from "@/game/content";
import {
  AULAS_POR_CICLO,
  CICLOS,
  atributoDe,
  confundido,
  dañoDe,
  initialState,
  nombreDe,
  puedeHuir,
  reduce,
} from "@/game/engine";
import { DEFECTOS, PODERES } from "@/game/poderes";
import { SPRITES } from "@/game/sprites";
import type { Accion, Action, Atributo, State } from "@/game/types";

export default function Juego() {
  // Arranca en null: el estado inicial usa el RNG y generarlo en el servidor
  // rompería la hidratación.
  const [state, setState] = useState<State | null>(null);
  const dispatch = (a: Action) => setState((s) => (s ? reduce(s, a) : s));

  if (!state) return <Portada onStart={() => setState(initialState())} />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <Cabecera state={state} />

      {state.fase === "eligiendo-aula" && (
        <EligiendoAula state={state} dispatch={dispatch} />
      )}
      {state.fase === "combate" && <Combate state={state} dispatch={dispatch} />}
      {state.fase === "recompensa" && (
        <Pausa state={state} dispatch={dispatch} />
      )}
      {state.fase === "subir-nivel" && (
        <SubirNivel state={state} dispatch={dispatch} />
      )}
      {state.fase === "sueño" && <Sueño state={state} dispatch={dispatch} />}
      {(state.fase === "muerto" || state.fase === "fin") && (
        <Final state={state} onRestart={() => setState(initialState())} />
      )}

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

function Barra({
  valor,
  max,
  color = "bg-agua",
  bloques = 20,
}: {
  valor: number;
  max: number;
  color?: string;
  bloques?: number;
}) {
  const llenos = Math.max(0, Math.round((valor / max) * bloques));
  return (
    <div className="flex gap-px">
      {Array.from({ length: bloques }, (_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 ${i < llenos ? color : "bg-dimmer"}`}
        />
      ))}
    </div>
  );
}

/** Con confusión activa los números se muestran mal. */
function num(n: number, confuso: boolean): string {
  const s = String(Math.max(0, Math.round(n)));
  return confuso ? s.slice(0, -1) + "?" : s;
}

// --- portada --------------------------------------------------------------

function Portada({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-12 px-6 py-24">
      <div className="space-y-6 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-agua">VIGILIA</h1>
        <p className="text-sm leading-relaxed text-dim">
          Sonó el timbre.
          <br />
          No te acordás de haber entrado.
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

// --- cabecera -------------------------------------------------------------

const NOMBRE_EFECTO: Record<string, string> = {
  confusion: "CONFUSIÓN",
  miedo: "MIEDO",
  torpeza: "TORPEZA",
};

function Cabecera({ state }: { state: State }) {
  const j = state.jugador;
  const c = confundido(state);
  return (
    <header className="space-y-3">
      <div className="flex items-baseline justify-between text-xs tracking-widest text-dim">
        <span className="text-agua">Nv.{j.nivel}</span>
        <span>
          CICLO {state.ciclo}/{CICLOS} · AULA{" "}
          {Math.min(state.aulasHechas + 1, AULAS_POR_CICLO)}/{AULAS_POR_CICLO}
        </span>
      </div>

      <div className="space-y-1">
        <Barra valor={j.vida} max={j.vidaMax} />
        <div className="flex justify-between text-xs text-dim">
          <span>VIDA</span>
          <span className="tabular-nums">
            {num(j.vida, c)}/{num(j.vidaMax, c)}
          </span>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-dim">
        <span>CON {num(j.atributos.conocimiento, c)}</span>
        <span>NER {num(j.atributos.nervio, c)}</span>
        <span>REF {num(j.atributos.reflejos, c)}</span>
        <span className="ml-auto">XP {num(j.xp, c)}/{num(j.xpSiguiente, c)}</span>
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

// --- elegir aula ----------------------------------------------------------

function EligiendoAula({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  const c = confundido(state);
  return (
    <section className="space-y-3">
      <p className="text-xs tracking-widest text-dim">EL PASILLO</p>
      {state.aulas.map((aula) => {
        const materia = MATERIAS[aula.materiaId];
        const deform = state.deformacion[aula.materiaId] ?? 0;
        const nombre = nombreDe(state, aula.materiaId);
        const atributo = atributoDe(state, aula.materiaId);
        return (
          <button
            key={aula.id}
            onClick={() => dispatch({ type: "elegir-aula", aulaId: aula.id })}
            className="flex w-full items-center gap-4 border border-dimmer p-4 text-left transition-colors hover:border-agua"
          >
            <Sprite materiaId={aula.materiaId} clase="w-16 shrink-0 opacity-60" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                {deform >= 2 && (
                  <span className="text-xs text-dim line-through">
                    {materia.nombre}
                  </span>
                )}
                <span className="text-sm font-bold">{nombre}</span>
              </div>
              <div className="mt-1 text-xs text-agua-hondo">
                lastima {atributo}
              </div>
              <ul className="mt-2 space-y-0.5">
                {aula.lecturas.map((l) => (
                  <li key={l.enemigoId} className="flex gap-2 text-xs text-dim">
                    <span className="w-9 shrink-0 tabular-nums">
                      {num(l.prob * 100, c)}%
                    </span>
                    <span className="truncate">{ENEMIGOS[l.enemigoId].nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          </button>
        );
      })}
    </section>
  );
}

// --- combate --------------------------------------------------------------

function Combate({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  const [menu, setMenu] = useState<"items" | "poderes" | null>(null);
  const c = state.combate;
  if (!c) return null;
  const enemigo = ENEMIGOS[c.enemigoId];
  const intencion = enemigo.patron[c.paso % enemigo.patron.length];
  const conf = confundido(state);
  const j = state.jugador;

  const act = (accion: Accion, ref?: string) => {
    setMenu(null);
    dispatch({ type: "combate", accion, ref });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col items-center gap-3 border border-dimmer p-5">
        <Sprite materiaId={c.materiaId} clase="respira" />
        <p className="text-center text-sm">{enemigo.nombre}</p>
        <div className="w-full space-y-1">
          <Barra valor={c.vida} max={c.vidaMax} color="bg-malo" />
          <div className="text-right text-xs tabular-nums text-dim">
            {num(c.vida, conf)}/{num(c.vidaMax, conf)}
          </div>
        </div>
        <p className="border-t border-dimmer pt-3 text-center text-xs text-agua">
          {intencion.tell}
        </p>
        {c.debilidadVista && (
          <p className="text-xs text-dim">
            cede ante <span className="text-agua">{enemigo.debilidad}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Boton
          label="RESOLVER"
          sub={`${dañoDe(state, "resolver")}`}
          onClick={() => act("resolver")}
        />
        <Boton label="AGUANTAR" sub="def" onClick={() => act("aguantar")} />
        <Boton
          label="ESQUIVAR"
          sub={`${dañoDe(state, "esquivar")}`}
          onClick={() => act("esquivar")}
        />
        <Boton
          label={j.armaId ? ARMAS[j.armaId].nombre.toUpperCase() : "SIN ARMA"}
          sub={j.armaId ? `${dañoDe(state, "arma")}` : "—"}
          disabled={!j.armaId}
          onClick={() => act("arma")}
        />
        <Boton
          label="ITEM"
          sub={`${j.items.length + j.sombras.length}`}
          disabled={j.items.length + j.sombras.length === 0}
          onClick={() => setMenu(menu === "items" ? null : "items")}
        />
        <Boton
          label="PODER"
          sub={`${j.poderes.reduce((a, p) => a + p.usos, 0)}`}
          disabled={!j.poderes.some((p) => p.usos > 0)}
          onClick={() => setMenu(menu === "poderes" ? null : "poderes")}
        />
      </div>

      {menu === "items" && (
        <div className="space-y-1 border border-dimmer p-3">
          {j.items.map((id, i) => (
            <button
              key={`${id}-${i}`}
              onClick={() => act("item", id)}
              className="block w-full text-left text-xs text-dim hover:text-foreground"
            >
              {ITEMS[id].nombre} — {ITEMS[id].descripcion}
            </button>
          ))}
          {j.sombras.map((id, i) => (
            <button
              key={`s-${id}-${i}`}
              onClick={() => act("item", `sombra:${id}`)}
              className="block w-full text-left text-xs text-sueno hover:text-foreground"
            >
              sombra de {ENEMIGOS[id].nombre} — te saca los efectos
            </button>
          ))}
        </div>
      )}

      {menu === "poderes" && (
        <div className="space-y-1 border border-dimmer p-3">
          {j.poderes.map((p) => (
            <button
              key={p.id}
              disabled={p.usos <= 0}
              onClick={() => act("poder", p.id)}
              className="block w-full text-left text-xs text-sueno disabled:opacity-30 hover:text-foreground"
            >
              {PODERES[p.id].nombre} ×{p.usos} — {PODERES[p.id].texto}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => act("huir")}
        disabled={!puedeHuir(state)}
        className="w-full border border-dimmer p-2 text-xs tracking-widest text-dim hover:border-dim disabled:opacity-25"
      >
        {puedeHuir(state) ? "HUIR" : "NO HAY PUERTA"}
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

// --- pausas ---------------------------------------------------------------

function Pausa({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  return (
    <section className="space-y-4 border border-agua-hondo p-5">
      <p className="text-xs tracking-widest text-agua">EL AULA QUEDA VACÍA</p>
      <button
        onClick={() => dispatch({ type: "seguir" })}
        className="w-full bg-agua p-3 text-xs font-bold tracking-widest text-background hover:opacity-80"
      >
        SEGUIR
      </button>
    </section>
  );
}

const ETIQUETA: Record<Atributo, string> = {
  conocimiento: "CONOCIMIENTO",
  nervio: "NERVIO",
  reflejos: "REFLEJOS",
};

function SubirNivel({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  return (
    <section className="space-y-4 border border-agua p-5">
      <p className="text-xs tracking-widest text-agua">
        NIVEL {state.jugador.nivel + 1}
      </p>
      <p className="text-xs text-dim">Algo se te acomodó. Elegí qué.</p>
      <div className="grid gap-2">
        {(Object.keys(ETIQUETA) as Atributo[]).map((a) => (
          <button
            key={a}
            onClick={() => dispatch({ type: "subir", atributo: a })}
            className="flex items-center justify-between border border-dimmer p-3 text-xs hover:border-agua"
          >
            <span className="font-bold">{ETIQUETA[a]}</span>
            <span className="text-dim">
              {state.jugador.atributos[a]} → {state.jugador.atributos[a] + 2}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// --- el sueño -------------------------------------------------------------

function Sueño({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  return (
    <section className="space-y-4">
      <p className="text-xs tracking-widest text-sueno">
        DORMISTE. ALGO TE OFRECE ALGO.
      </p>
      <div className="space-y-3">
        {state.oferta.map((par, i) => {
          const poder = PODERES[par.poderId];
          const defecto = DEFECTOS[par.defectoId];
          return (
            <button
              key={i}
              onClick={() => dispatch({ type: "aceptar-oferta", index: i })}
              className="w-full border border-dimmer p-4 text-left transition-colors hover:border-sueno"
            >
              <div className="text-sm font-bold text-agua">{poder.nombre}</div>
              <p className="mt-1 text-xs text-dim">{poder.texto}</p>
              <div className="mt-3 border-t border-dimmer pt-3">
                <div className="text-xs font-bold text-malo">
                  {defecto.nombre}
                </div>
                <p className="mt-1 text-xs text-dim">{defecto.texto}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- final ----------------------------------------------------------------

function Final({ state, onRestart }: { state: State; onRestart: () => void }) {
  const muerto = state.fase === "muerto";
  return (
    <section
      className={`space-y-5 border p-6 ${muerto ? "border-malo" : "border-agua"}`}
    >
      <p
        className={`text-xs tracking-widest ${muerto ? "text-malo" : "text-agua"}`}
      >
        {muerto ? "NO SONÓ NINGÚN TIMBRE" : "SALISTE"}
      </p>
      <p className="text-sm leading-relaxed">{state.final}</p>

      <div className="space-y-1 border-t border-dimmer pt-4 text-xs text-dim">
        <p>Nivel {state.jugador.nivel} · ciclo {state.ciclo} de {CICLOS}</p>
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

// --- bitácora -------------------------------------------------------------

const COLOR = {
  neutral: "text-dim",
  bueno: "text-agua",
  malo: "text-malo",
  sueño: "text-sueno",
  enemigo: "text-foreground",
} as const;

function Bitacora({ state }: { state: State }) {
  return (
    <section className="mt-auto space-y-1 border-t border-dimmer pt-4">
      {state.log.slice(0, 6).map((e, i) => (
        <p
          key={`${i}-${e.texto}`}
          className={`text-xs leading-relaxed ${COLOR[e.tipo]}`}
          style={{ opacity: Math.max(0.3, 1 - i * 0.14) }}
        >
          {e.texto}
        </p>
      ))}
    </section>
  );
}
