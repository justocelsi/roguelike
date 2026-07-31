#!/usr/bin/env -S npx tsx
/**
 * Banco de pruebas del juego. Corre bots contra el motor y mide.
 *
 *   npx tsx scripts/balance.ts            todo
 *   npx tsx scripts/balance.ts estilos    sólo el balance
 *   npx tsx scripts/balance.ts reglas     sólo las invariantes
 *
 * No es un test unitario: es una forma de contestar preguntas de diseño con
 * números en vez de con intuición. La pregunta que responde no es "¿cuál
 * estrategia gana?" sino "¿cuántas maneras distintas de jugar son viables?".
 *
 * Los bots tienen que jugar como jugaría una persona que mira la pantalla:
 * si la interfaz muestra un dato, el bot lo usa; si lo tapa, el bot no puede
 * mirarlo por abajo. Un bot que hace trampa da números que no sirven.
 */

import { ARMAS, ENEMIGOS, ITEMS, MATERIAS } from "../src/game/content";

import {
  armasUsables,
  initialState,
  MAX_ARMAS,
  reduce,
  tieneEfecto,
  usosArma,
  usosPoder,
  veElAviso,
} from "../src/game/engine";
import { PODERES } from "../src/game/poderes";
import type { Action, Intencion, State } from "../src/game/types";

const CORRIDAS = Number(process.env.CORRIDAS ?? 2000);

// --- utilidades del bot ---------------------------------------------------

function mejorArma(s: State, bruto = false): string | null {
  const u = armasUsables(s);
  if (!u.length) return null;
  const puntaje = (id: string) =>
    bruto ? ARMAS[id].daño : ARMAS[id].daño * ARMAS[id].precision;
  return u.reduce((a, b) => (puntaje(b) > puntaje(a) ? b : a));
}

function pegar(s: State, bruto = false): Action {
  const a = mejorArma(s, bruto);
  return a
    ? { type: "combate", accion: "arma", ref: a }
    : { type: "combate", accion: "atacar" };
}

/** Los items no gastan turno, así que curarse es gratis salvo por el item. */
function curar(s: State, umbral: number, guarda: boolean): Action | null {
  const j = s.jugador;
  if (j.vida >= j.vidaMax * umbral) return null;
  const esProfesor = s.combate && ENEMIGOS[s.combate.enemigoId].profesor;
  if (!guarda || esProfesor) {
    const it = j.items.find((i) => ITEMS[i].efecto.vida);
    if (it) return { type: "combate", accion: "usar", ref: it };
  }
  const pod = j.poderes.find((id) => usosPoder(s, id) > 0 && PODERES[id].efecto.vida);
  return pod ? { type: "combate", accion: "usar", ref: `poder:${pod}` } : null;
}

/** Lo que el bot puede ver del próximo movimiento. Null si está tapado. */
function proxima(s: State): Intencion | null {
  if (!veElAviso(s)) return null;
  const c = s.combate!;
  const p = ENEMIGOS[c.enemigoId].patron;
  return p[c.paso % p.length];
}

/** Bloquear sirve contra todo lo que no sea imparable. */
function convieneBloquear(i: Intencion | null): boolean {
  if (!i) return Math.random() < 0.45;
  return i.tipo !== "espera" && !i.imparable;
}

// --- estilos ---------------------------------------------------------------

type Estilo = {
  nombre: string;
  aulas: number;
  cura: number;
  guarda: boolean;
  bruto: boolean;
  /** Cómo decide el turno. */
  turno: "luchador" | "pasivo" | "calculador";
};

function decidir(s: State, e: Estilo): Action {
  const c = curar(s, e.cura, e.guarda);
  if (c) return c;
  if (e.turno === "luchador") return pegar(s, e.bruto);

  const i = proxima(s);
  if (e.turno === "pasivo") {
    return convieneBloquear(i) ? { type: "combate", accion: "bloquear" } : pegar(s, e.bruto);
  }
  // Calculador: si lo puede matar antes del golpe, va.
  if (!convieneBloquear(i)) return pegar(s, e.bruto);
  const arma = mejorArma(s, e.bruto);
  const miDaño = arma ? ARMAS[arma].daño : 6;
  if (s.combate!.vida <= miDaño) return pegar(s, e.bruto);
  return { type: "combate", accion: "bloquear" };
}

function correr(e: Estilo) {
  let muertes = 0;
  let ciclo = 0;
  for (let n = 0; n < CORRIDAS; n++) {
    let s = initialState((Math.random() * 1e9) | 0);
    let pasos = 0;
    let quieto = 0;
    while (s.fase !== "muerto" && s.fase !== "fin" && pasos < 12000) {
      let a: Action | null = null;
      if (s.fase === "pasillo") {
        const libres = s.mundo!.puertas.filter((p) => !p.usada);
        const aulas = libres.filter((p) => !p.profesor);
        const hechas = s.mundo!.puertas.filter((p) => p.usada && !p.profesor).length;
        const p =
          hechas < e.aulas && aulas.length ? aulas[0] : libres.find((q) => q.profesor);
        if (!p) break;
        a = { type: "entrar-aula", puertaX: p.x, puertaY: p.y };
      } else if (s.fase === "combate") a = decidir(s, e);
      else if (s.fase === "recompensa") {
        a = s.armaOfrecida
          ? { type: "canjear-arma", dejar: s.jugador.armas[0] }
          : { type: "seguir" };
      } else if (s.fase === "sueño") a = { type: "aceptar-oferta", index: 0 };
      if (!a) break;
      const antes = s;
      s = reduce(s, a);
      pasos++;
      if (s === antes) {
        if (++quieto > 40) break;
      } else quieto = 0;
    }
    if (s.fase === "muerto") muertes++;
    ciclo += s.ciclo;
  }
  console.log(
    `  ${e.nombre.padEnd(30)} muertes ${((muertes / CORRIDAS) * 100).toFixed(1)}%` +
      `   ciclo ${(ciclo / CORRIDAS).toFixed(1)}`,
  );
}

const ESTILOS: Estilo[] = [
  { nombre: "luchador", aulas: 99, cura: 0.3, guarda: false, bruto: false, turno: "luchador" },
  { nombre: "pasivo", aulas: 99, cura: 0.35, guarda: false, bruto: false, turno: "pasivo" },
  { nombre: "calculador", aulas: 99, cura: 0.35, guarda: false, bruto: false, turno: "calculador" },
  { nombre: "guarda los items", aulas: 99, cura: 0.35, guarda: true, bruto: false, turno: "calculador" },
  { nombre: "media pasada", aulas: 2, cura: 0.4, guarda: false, bruto: false, turno: "calculador" },
  { nombre: "a lo bruto", aulas: 99, cura: 0.3, guarda: false, bruto: true, turno: "luchador" },
  { nombre: "derecho al profesor", aulas: 0, cura: 0.4, guarda: false, bruto: false, turno: "calculador" },
];

// --- invariantes -----------------------------------------------------------

function reglas() {
  const fallas: Record<string, number> = {};
  const ej: Record<string, string> = {};
  const fallo = (r: string, d = "") => {
    fallas[r] = (fallas[r] ?? 0) + 1;
    if (!ej[r]) ej[r] = d;
  };

  for (let n = 0; n < 1200; n++) {
    let s = initialState((Math.random() * 1e9) | 0);
    let pasos = 0;
    let quieto = 0;
    while (s.fase !== "muerto" && s.fase !== "fin" && pasos < 12000) {
      const antes = s;
      let a: Action | null = null;
      if (s.fase === "pasillo") {
        const l = s.mundo!.puertas.filter((p) => !p.usada);
        if (!l.length) break;
        const p = l[Math.floor(Math.random() * l.length)];
        a = { type: "entrar-aula", puertaX: p.x, puertaY: p.y };
      } else if (s.fase === "combate") {
        const j = s.jugador;
        const ops: Action[] = [
          { type: "combate", accion: "atacar" },
          { type: "combate", accion: "bloquear" },
        ];
        const arma = armasUsables(s)[0];
        if (arma) ops.push({ type: "combate", accion: "arma", ref: arma });
        if (j.items[0]) ops.push({ type: "combate", accion: "usar", ref: j.items[0] });
        const pod = j.poderes.find((id) => usosPoder(s, id) > 0);
        if (pod) ops.push({ type: "combate", accion: "usar", ref: `poder:${pod}` });
        a = ops[Math.floor(Math.random() * ops.length)];
      } else if (s.fase === "recompensa") {
        a = s.armaOfrecida
          ? { type: "canjear-arma", dejar: Math.random() < 0.5 ? s.jugador.armas[0] : null }
          : { type: "seguir" };
      } else if (s.fase === "sueño") {
        a = { type: "aceptar-oferta", index: Math.floor(Math.random() * s.oferta.length) };
      }
      if (!a) break;
      const teniaMiedo = tieneEfecto(antes, "miedo");
      s = reduce(s, a);
      pasos++;
      if (s === antes) {
        if (++quieto > 40) break;
        continue;
      }
      quieto = 0;

      // Al entrar a un aula entrás entero y con todo recargado.
      if (antes.fase === "pasillo" && s.fase === "combate") {
        if (s.jugador.vida !== s.jugador.vidaMax) fallo("la vida entra llena");
        for (const id of s.jugador.armas) {
          const esperado = ARMAS[id].infinita ? Infinity : ARMAS[id].usos;
          if (usosArma(s, id) !== esperado) fallo("los usos entran recargados", id);
        }
        const c = s.combate!;
        if (c.buff !== 0 || c.escudo || c.sangria) fallo("los buffs no cruzan la puerta");
      }

      // Las armas sólo se van por canje o por rebote.
      for (const id of antes.jugador.armas.filter((x) => !s.jugador.armas.includes(x))) {
        const legal = a.type === "canjear-arma" || (!!ARMAS[id].perdida && a.type === "combate");
        if (!legal) fallo("las armas no desaparecen solas", id);
      }
      if (s.jugador.armas.length > MAX_ARMAS) fallo("tope de armas");
      if (new Set(s.jugador.armas).size !== s.jugador.armas.length) fallo("sin repetidas");
      if (antes.fase === "recompensa" && s.fase === "pasillo" && antes.armaOfrecida) {
        fallo("no se sale sin decidir el arma");
      }
      if (s.jugador.vida <= 0 && s.fase !== "muerto") fallo("vida en cero implica muerte");

      // Nada te agarra sin haber sido anunciado.
      const i0 = antes.log[0] ? s.log.indexOf(antes.log[0]) : s.log.length;
      const nuevas = s.log.slice(0, i0 === -1 ? s.log.length : i0);
      if (a.type === "combate" && nuevas.some((e) => e.texto.includes("No te sale")) && !teniaMiedo) {
        fallo("el miedo sólo actúa si lo tenés");
      }
      const limpiado =
        s.fase !== "combate" || nuevas.some((e) => /Usás|se interpone|Lucidez|timbre/.test(e.texto));
      for (const e of nuevas) {
        if (e.icono && !limpiado && !s.efectos.some((x) => x.efecto === e.icono)) {
          fallo("el estado que te agarra queda marcado", e.icono);
        }
      }

      // Las recompensas nunca salen de otra materia.
      if (antes.fase === "combate" && s.fase === "recompensa") {
        const m = antes.combate!.materiaId;
        for (const b of s.botin) {
          if (b.tipo === "item" && !MATERIAS[m].items.includes(b.id)) fallo("botín de su materia", b.id);
          if (b.tipo === "arma" && !MATERIAS[m].armas.includes(b.id)) fallo("botín de su materia", b.id);
        }
      }
    }
  }

  const REGLAS = [
    "la vida entra llena",
    "los usos entran recargados",
    "los buffs no cruzan la puerta",
    "las armas no desaparecen solas",
    "tope de armas",
    "sin repetidas",
    "no se sale sin decidir el arma",
    "vida en cero implica muerte",
    "el miedo sólo actúa si lo tenés",
    "el estado que te agarra queda marcado",
    "botín de su materia",
  ];
  let todo = true;
  for (const r of REGLAS) {
    const n = fallas[r] ?? 0;
    if (n) todo = false;
    console.log(`  ${n === 0 ? "OK   " : "FALLA"} ${r}${n ? `  (${n}, ej: ${ej[r]})` : ""}`);
  }
  return todo;
}

// --- cli -------------------------------------------------------------------

const que = process.argv[2];

if (!que || que === "estilos") {
  console.log(`\nESTILOS  (${CORRIDAS} runs cada uno)`);
  for (const e of ESTILOS) correr(e);
}
if (!que || que === "reglas") {
  console.log("\nINVARIANTES");
  const ok = reglas();
  console.log(ok ? "\n  todas se cumplen" : "\n  HAY REGLAS ROTAS");
  if (!ok) process.exitCode = 1;
}
