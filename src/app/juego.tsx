"use client";

import { useState } from "react";
import { EVENTS } from "@/game/content";
import { getDistortion } from "@/game/distortions";
import {
  CICLOS,
  canObserve,
  flags,
  formatProbability,
  initialState,
  reduce,
  verbCost,
} from "@/game/engine";
import type { Action, State } from "@/game/types";

export default function Juego() {
  // Arranca en null a propósito: el estado inicial usa el RNG, y generarlo
  // durante el render del servidor rompería la hidratación.
  const [state, setState] = useState<State | null>(null);
  const dispatch = (a: Action) => setState((s) => (s ? reduce(s, a) : s));

  if (!state) return <Portada onStart={() => setState(initialState())} />;

  const f = flags(state);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <Cabecera state={state} />

      {state.phase === "eligiendo-sala" && (
        <EligiendoSala state={state} dispatch={dispatch} f={f} />
      )}
      {state.phase === "en-sala" && (
        <EnSala state={state} dispatch={dispatch} />
      )}
      {state.phase === "durmiendo" && (
        <Durmiendo state={state} dispatch={dispatch} />
      )}
      {(state.phase === "muerto" || state.phase === "fin") && (
        <Final state={state} onRestart={() => setState(initialState())} />
      )}

      <Bitacora state={state} />
    </main>
  );
}

// --- portada --------------------------------------------------------------

function Portada({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl tracking-[0.3em]">VIGILIA</h1>
        <p className="text-sm leading-relaxed text-dim">
          El mundo se reescribe mientras dormís.
          <br />
          Vos elegís cómo.
          <br />
          Sos el único que recuerda la versión anterior.
        </p>
      </div>
      <button
        onClick={onStart}
        className="border border-dim px-8 py-3 text-sm tracking-widest transition-colors hover:bg-foreground hover:text-background"
      >
        DESPERTAR
      </button>
    </main>
  );
}

// --- cabecera -------------------------------------------------------------

function Cabecera({ state }: { state: State }) {
  return (
    <header className="space-y-3 border-b border-dimmer pb-5">
      <div className="flex items-baseline justify-between text-xs tracking-widest text-dim">
        <span>VIGILIA</span>
        <span>
          CICLO {state.cycle} / {CICLOS}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-px" aria-label={`Vigilia ${state.vigilia}`}>
          {Array.from({ length: state.vigiliaMax }, (_, i) => (
            <div
              key={i}
              className={`h-3 w-2 ${i < state.vigilia ? "bg-foreground" : "bg-dimmer"}`}
            />
          ))}
        </div>
        <span className="text-xs text-dim">
          {state.vigilia}/{state.vigiliaMax}
        </span>
      </div>

      {(state.chicas.length > 0 || state.grande) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
          {state.grande && (
            <span className="text-sueno">
              ◆ {getDistortion(state.grande).name}
            </span>
          )}
          {state.chicas.map((id) => (
            <span key={id} className="text-dim">
              · {getDistortion(id).name}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

// --- elegir sala ----------------------------------------------------------

function EligiendoSala({
  state,
  dispatch,
  f,
}: {
  state: State;
  dispatch: (a: Action) => void;
  f: ReturnType<typeof flags>;
}) {
  return (
    <section className="space-y-6">
      <p className="text-xs tracking-widest text-dim">ELEGÍ</p>

      <div className="space-y-3">
        {state.rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => dispatch({ type: "elegir-sala", roomId: room.id })}
            className="group w-full border border-dimmer p-4 text-left transition-colors hover:border-dim"
          >
            <div className="mb-2 text-sm">{room.name}</div>

            {f.hideReadings ? (
              <div className="text-xs text-dimmer">
                No se anuncia. Sigue siendo lo que es.
              </div>
            ) : (
              <ul className="space-y-1">
                {room.readings.map((r) => (
                  <li key={r.eventId} className="flex gap-3 text-xs text-dim">
                    <span className="w-12 shrink-0 tabular-nums">
                      {formatProbability(r.declared, state)}
                    </span>
                    <span>{EVENTS[r.eventId].label}</span>
                  </li>
                ))}
              </ul>
            )}

            {f.revealBeforeEntering && (
              <div className="mt-2 border-t border-dimmer pt-2 text-xs text-sueno">
                Sabés que hay {EVENTS[room.rolled].label}.
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => dispatch({ type: "dormir" })}
        disabled={f.noVoluntarySleep}
        className="w-full border border-dimmer p-3 text-xs tracking-widest text-dim transition-colors hover:border-dim hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-dimmer disabled:hover:text-dim"
      >
        {f.noVoluntarySleep ? "YA NO PODÉS DORMIR CUANDO QUERÉS" : "DORMIR"}
      </button>
    </section>
  );
}

// --- dentro de la sala ----------------------------------------------------

function EnSala({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  const ev = state.currentEvent ? EVENTS[state.currentEvent] : null;
  if (!ev || !state.currentRoom) return null;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs tracking-widest text-dim">ESTÁS ADENTRO</p>
        <h2 className="mt-2 text-sm">{state.currentRoom.name}</h2>
      </div>

      <p className="min-h-12 text-sm leading-relaxed">
        {state.observed ? (
          ev.reveal
        ) : (
          <span className="text-dim">
            Hay algo. No sabés qué, y actuar sin saber sale distinto.
          </span>
        )}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Verbo
          label="Observar"
          costo={verbCost(state, "observar")}
          disabled={!canObserve(state)}
          onClick={() => dispatch({ type: "verbo", verb: "observar" })}
        />
        <Verbo
          // El verbo específico revelaría qué es. A ciegas, es sólo "Actuar".
          label={state.observed ? ev.actVerb : "Actuar"}
          costo={verbCost(state, "actuar")}
          onClick={() => dispatch({ type: "verbo", verb: "actuar" })}
        />
        <Verbo
          label="Retirarte"
          costo={0}
          onClick={() => dispatch({ type: "verbo", verb: "retirarse" })}
        />
      </div>
    </section>
  );
}

function Verbo({
  label,
  costo,
  disabled,
  onClick,
}: {
  label: string;
  costo: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="border border-dimmer p-3 text-center text-xs transition-colors hover:border-dim disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-dimmer"
    >
      <div>{label}</div>
      <div className="mt-1 text-dim">{costo > 0 ? `−${costo}` : "—"}</div>
    </button>
  );
}

// --- el sueño -------------------------------------------------------------

function Durmiendo({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (a: Action) => void;
}) {
  return (
    <section className="space-y-6">
      <p className="text-xs tracking-widest text-sueno">
        {state.forced ? "EL SUEÑO ELIGE POR VOS" : "ELEGÍ QUÉ CAMBIA"}
      </p>

      <div className="space-y-3">
        {state.offered.map((id) => {
          const d = getDistortion(id);
          const reemplaza =
            d.tier === "grande" && state.grande && state.grande !== d.id
              ? getDistortion(state.grande).name
              : null;
          return (
            <button
              key={id}
              onClick={() => dispatch({ type: "elegir-distorsion", id })}
              className="w-full border border-dimmer p-4 text-left transition-colors hover:border-sueno"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm">{d.name}</span>
                <span className="text-xs text-dim">
                  {d.tier === "grande" ? "◆ reemplaza" : "· se suma"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-dim">{d.text}</p>
              {reemplaza && (
                <p className="mt-2 text-xs text-malo">Perdés: {reemplaza}.</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- final ----------------------------------------------------------------

function Final({ state, onRestart }: { state: State; onRestart: () => void }) {
  const muerto = state.phase === "muerto";
  return (
    <section className="space-y-6 border border-dimmer p-6">
      <p
        className={`text-xs tracking-widest ${muerto ? "text-malo" : "text-sueno"}`}
      >
        {muerto ? "SE ACABÓ" : "SOBREVIVISTE"}
      </p>
      <p className="text-sm leading-relaxed">{state.ending}</p>

      {(state.grande || state.chicas.length > 0) && (
        <div className="space-y-1 border-t border-dimmer pt-4 text-xs text-dim">
          <p>Terminaste jugando a esto:</p>
          {state.grande && <p>◆ {getDistortion(state.grande).name}</p>}
          {state.chicas.map((id) => (
            <p key={id}>· {getDistortion(id).name}</p>
          ))}
        </div>
      )}

      <button
        onClick={onRestart}
        className="w-full border border-dim p-3 text-xs tracking-widest transition-colors hover:bg-foreground hover:text-background"
      >
        OTRA VEZ
      </button>
    </section>
  );
}

// --- bitácora -------------------------------------------------------------

const COLOR = {
  neutral: "text-dim",
  bueno: "text-bueno",
  malo: "text-malo",
  sueño: "text-sueno",
} as const;

function Bitacora({ state }: { state: State }) {
  return (
    <section className="mt-auto space-y-1 border-t border-dimmer pt-5">
      {state.log.slice(0, 8).map((entry, i) => (
        <p
          key={`${i}-${entry.text}`}
          className={`text-xs leading-relaxed ${COLOR[entry.kind]}`}
          style={{ opacity: Math.max(0.25, 1 - i * 0.12) }}
        >
          {entry.text}
        </p>
      ))}
    </section>
  );
}
