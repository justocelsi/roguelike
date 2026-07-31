#!/usr/bin/env -S npx tsx
/**
 * Banco de pruebas del juego. Corre bots contra el motor y mide.
 *
 *   npx tsx scripts/balance.ts            todo
 *   npx tsx scripts/balance.ts estilos    sólo el balance
 *   npx tsx scripts/balance.ts reglas     sólo las invariantes
 *   RULETA=1 npx tsx scripts/balance.ts reglas   qué salió en cada arco
 *
 * No es un test unitario: es una forma de contestar preguntas de diseño con
 * números en vez de con intuición. La pregunta que responde no es "¿cuál
 * estrategia gana?" sino "¿cuántas maneras distintas de jugar son viables?".
 *
 * Los bots tienen que jugar como jugaría una persona que mira la pantalla:
 * si la interfaz muestra un dato, el bot lo usa; si lo tapa, el bot no puede
 * mirarlo por abajo. Un bot que hace trampa da números que no sirven.
 */

import { ARMAS, ENEMIGOS, ITEMS, ITEM_IDS, MATERIAS } from "../src/game/content";
import { ICONOS_ITEM } from "../src/game/sprites";

import {
  armasUsables,
  initialState,
  MAX_ARMAS,
  PASA_BLOQUEANDO,
  reduce,
  tieneEfecto,
  usosArma,
  usosPoder,
  veElAviso,
} from "../src/game/engine";
import { armarMinijuego, jugar, premioDe, type Minijuego } from "../src/game/minijuegos";
import { PODERES } from "../src/game/poderes";
import { FORMAS_PUERTA, generarPasillo } from "../src/game/mundo";
import type { Rng } from "../src/game/rng";
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
  const pod = j.poderes.find(
    (id) => !PODERES[id].pasivo && usosPoder(s, id) > 0 && PODERES[id].efecto.vida,
  );
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

/**
 * El bot juega los minijuegos como jugaría alguien decente, no perfecto:
 * en el pizarrón se acuerda de tres de cada cuatro, en la apuesta se va
 * cuando la suerte deja de convenirle, y en el examen acierta a veces.
 */
function jugarMinijuego(s: State): Action {
  const j = s.minijuego!;
  if (j.tipo === "pizarron") {
    const i = j.puestos!.length;
    const correcto = j.opcionesSimbolo!.indexOf(j.secuencia![i]);
    const acierta = Math.random() < 0.75;
    return {
      type: "juego",
      eleccion: acierta
        ? correcto
        : Math.floor(Math.random() * j.opcionesSimbolo!.length),
    };
  }
  if (j.tipo === "apuesta") {
    // Seguir conviene mientras el valor esperado suba: p·(n+1) > n.
    const p = j.suerte! / 100;
    return { type: "juego", eleccion: p * (j.juntado! + 1) > j.juntado! ? 1 : 0 };
  }
  const acierta = Math.random() < 0.6;
  return {
    type: "juego",
    eleccion: acierta ? j.correcta! : (j.correcta! + 1) % 3,
  };
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

/**
 * Todo lo que sale por USAR es gratis en tiempo, así que un jugador que mira la
 * pantalla vacía el cargador antes de pegar: los usos de los poderes vuelven en
 * la próxima pelea y guardarlos no compra nada.
 *
 * Los items sí valen guardarse —no se recargan— y de eso se ocupa `curar`.
 */
function gratis(s: State, e: Estilo): Action | null {
  const j = s.jugador;
  // Sacarse los estados de encima, si la pelea todavía tiene cuerda como para
  // que valga gastar un trofeo.
  if (s.efectos.length && j.sombras.length && s.combate!.vida > s.combate!.vidaMax * 0.4) {
    return { type: "combate", accion: "usar", ref: `sombra:${j.sombras[0]}` };
  }
  const c = curar(s, e.cura, e.guarda);
  if (c) return c;
  const pod = j.poderes.find(
    (id) => !PODERES[id].pasivo && usosPoder(s, id) > 0 && PODERES[id].efecto.daño,
  );
  return pod ? { type: "combate", accion: "usar", ref: `poder:${pod}` } : null;
}

function decidir(s: State, e: Estilo): Action {
  const c = gratis(s, e);
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

/**
 * Una partida sana termina en "muerto" o en "fin". Si el bot se queda sin saber
 * qué mandar en alguna fase, sale del bucle y esa run entra igual al promedio
 * como si hubiera terminado bien — que es exactamente cómo se coló el bug de
 * los minijuegos: los estilos "morían" un 20% porque el 40% de las runs se
 * cortaban en el ciclo 1. Así que contarlas y gritarlas es parte de la prueba.
 */
function contarCorte(donde: string) {
  cortes[donde] = (cortes[donde] ?? 0) + 1;
}
const cortes: Record<string, number> = {};

function avisarCortes() {
  const total = Object.values(cortes).reduce((a, b) => a + b, 0);
  if (!total) return;
  console.log(`\n  ✗ ${total} runs se cortaron sin terminar. Los números de arriba mienten.`);
  for (const [donde, n] of Object.entries(cortes)) console.log(`      ${donde}: ${n}`);
  process.exitCode = 1;
}

function correr(e: Estilo) {
  let muertes = 0;
  let ciclo = 0;
  for (let n = 0; n < CORRIDAS; n++) {
    let s = initialState((Math.random() * 1e9) | 0);
    let pasos = 0;
    let quieto = 0;
    let motivo: string | null = null;
    while (s.fase !== "muerto" && s.fase !== "fin" && pasos < 12000) {
      let a: Action | null = null;
      if (s.fase === "pasillo") {
        const libres = s.mundo!.puertas.filter((p) => !p.usada);
        const aulas = libres.filter((p) => !p.profesor);
        const hechas = s.mundo!.puertas.filter((p) => p.usada && !p.profesor).length;
        const p =
          hechas < e.aulas && aulas.length ? aulas[0] : libres.find((q) => q.profesor);
        if (!p) {
          motivo = "no quedan puertas en el pasillo";
          break;
        }
        a = { type: "entrar-aula", puertaX: p.x, puertaY: p.y };
      } else if (s.fase === "combate") a = decidir(s, e);
      else if (s.fase === "juego") a = jugarMinijuego(s);
      else if (s.fase === "recompensa") {
        a = s.armaOfrecida
          ? { type: "canjear-arma", dejar: s.jugador.armas[0] }
          : { type: "seguir" };
      } else if (s.fase === "sueño") a = { type: "aceptar-oferta", index: 0 };
      if (!a) {
        motivo = `el bot no sabe qué hacer en "${s.fase}"`;
        break;
      }
      const antes = s;
      s = reduce(s, a);
      pasos++;
      if (s === antes) {
        if (++quieto > 40) {
          motivo = `el motor no se mueve en "${s.fase}"`;
          break;
        }
      } else quieto = 0;
    }
    if (s.fase === "muerto") muertes++;
    else if (s.fase !== "fin") contarCorte(motivo ?? `se quedó en "${s.fase}"`);
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

  /*
   * Cada tirada que el reloj va a mostrar, agrupada por el porcentaje que
   * declara. Es la prueba más fuerte que se le puede hacer a la ruleta: si el
   * arco dice 64% y la aguja cae en éxito el 90% de las veces, el reloj miente
   * — y mentir sobre el azar declarado es justo lo que el juego no puede hacer.
   *
   * Ya agarró uno: la tirada del bloqueo multiplicaba por el miedo una segunda
   * vez, cuando esa tirada ya se había hecho al apretar el botón.
   */
  const ruleta: Record<number, { n: number; salieron: number }> = {};
  /** Para que la prueba del escudo no pase por no haber visto ninguno. */
  let escudosVistos = 0;

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
      } else if (s.fase === "juego") a = jugarMinijuego(s);
      else if (s.fase === "recompensa") {
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
      /*
       * El escudo se ve hasta que se rompe, y se rompe una sola vez.
       *
       * La marca de "estás cubierto" sale de la foto de cada evento, no del
       * estado: si saliera del estado, se apagaría en cuanto el motor resuelve
       * el turno, o sea antes de que la secuencia muestre el golpe que frenó.
       * Así que la cuenta sólo puede bajar en el evento que lo dice.
       */
      if (antes.fase === "combate") {
        let previo = antes.combate!.escudo;
        for (const e of [...nuevas].reverse()) {
          const ahora = e.escudo ?? previo;
          if (e.escudoUsado) {
            escudosVistos++;
            if (ahora !== previo - 1) {
              fallo("el escudo se gasta de a uno", `${previo} → ${ahora}`);
            }
          } else if (ahora < previo) {
            fallo("el escudo no se apaga sin decirlo", e.texto);
          }
          previo = ahora;
        }
      }

      /*
       * Un enemigo no revive. Cada evento lleva la foto de cómo quedaron las
       * vidas justo después, y la interfaz dibuja la barra con esa foto — así
       * que si un evento no la trae, la barra cae al estado actual y salta.
       *
       * Es lo que pasaba al matarlo: las líneas de la victoria no traían foto y
       * la barra volvía al valor de antes del remate. Se veía revivir.
       */
      if (antes.fase === "combate") {
        const cronologicas = [...nuevas].reverse();
        let previa = antes.combate!.vida;
        for (const e of cronologicas) {
          if (e.vidaEnemigo === undefined) {
            fallo("cada evento del combate dice cómo quedó el enemigo", e.texto);
            continue;
          }
          if (e.vidaEnemigo > previa) fallo("el enemigo no revive", e.texto);
          previa = e.vidaEnemigo;
        }
      }

      for (const e of nuevas) {
        if (!e.tirada) continue;
        const { prob, salio } = e.tirada;
        /*
         * Todo porcentaje que se muestre va de a 5. Es lo que se puede pensar
         * de cabeza en el medio de un turno, y es la razón por la que el miedo
         * resta en vez de multiplicar: multiplicando, 90% con miedo daba 63%.
         */
        if (!Number.isInteger(prob) || prob < 0 || prob > 100 || prob % 5 !== 0) {
          fallo("los porcentajes del combate van de a 5", `${prob}% en "${e.texto}"`);
        }
        const b = (ruleta[prob] ??= { n: 0, salieron: 0 });
        b.n++;
        if (salio) b.salieron++;
      }

      const limpiado =
        s.fase !== "combate" || nuevas.some((e) => /Usás|se interpone|Lucidez|timbre/.test(e.texto));
      for (const e of nuevas) {
        if (e.icono && !limpiado && !s.efectos.some((x) => x.efecto === e.icono)) {
          fallo("el estado que te agarra queda marcado", e.icono);
        }
      }

      /*
       * Nadie muere sin ver morirse. Si la vida llegó a cero, en el mismo paso
       * tiene que estar lo que hizo el enemigo y la línea de la muerte: sin
       * ellas el jugador hace su acción y aparece la pantalla del final, como
       * si el juego hubiera hecho la cuenta sin mostrarla.
       */
      if (s.fase === "muerto" && antes.fase === "combate") {
        if (!nuevas.some((e) => e.actor === "eso")) {
          fallo("morir se ve venir", "no hay turno del enemigo en el paso final");
        }
        if (!nuevas.some((e) => e.texto === "Se te apaga todo.")) {
          fallo("morir se ve venir", "no hay línea de muerte");
        }
      }

      if (a.type === "combate") {
        /*
         * Cubrirse vale para el turno entero. Con torpeza el enemigo se mueve
         * dos veces, y cada movimiento consultaba el estado de bloqueo por su
         * cuenta: el primero lo apagaba y el segundo entraba de lleno. La
         * pantalla muestra los dos avisos y un solo botón, así que no había
         * forma de saber que sólo se tapaba la mitad.
         *
         * "De lleno" es el texto del golpe que entra sin que te estuvieras
         * cubriendo: si te cubriste, no puede aparecer nunca.
         */
        if (a.accion === "bloquear" && nuevas.some((e) => e.texto.startsWith("De lleno"))) {
          fallo("cubrirse vale para todo el turno");
        }

        /*
         * Y el estado del combate no se desborda por acumulación: dos anteojos
         * seguidos, tres cafés, un estado aplicado encima de sí mismo.
         */
        const cb = s.combate;
        if (cb) {
          if (cb.escudo < 0 || cb.escudo > 6) fallo("el escudo no se desborda", String(cb.escudo));
          if (cb.buff < 0) fallo("el escudo no se desborda", `buff ${cb.buff}`);
        }
        const tipos = s.efectos.map((e) => e.efecto);
        if (new Set(tipos).size !== tipos.length) {
          fallo("un estado no se apila consigo mismo", tipos.join(","));
        }
        if (s.efectos.some((e) => e.turnos < 1 || e.turnos > 4)) {
          fallo("un estado no dura más de lo declarado", JSON.stringify(s.efectos));
        }

        /*
         * Un bloqueo que sale para el golpe entero, igual que para un estado.
         * `Math.max(1, …)` sobre un daño que ya era cero dejaba pasar 1: la
         * pantalla decía "lo bloqueás" y la barra bajaba igual.
         */
        for (const e of nuevas) {
          const m = /^Lo bloqueás\. Sólo −(\d+)\.$/.exec(e.texto);
          if (m && Number(m[1]) > 0 && PASA_BLOQUEANDO === 0) {
            fallo("un bloqueo que sale para el golpe entero", e.texto);
          }
        }

        /*
         * USAR no gasta el turno: ni item, ni sombra, ni poder. Los tres viven
         * en el mismo menú, así que una excepción se aprende como una trampa.
         */
        if (a.accion === "usar" && nuevas.some((e) => e.actor === "eso")) {
          fallo("usar no le da el turno al enemigo", String(a.ref));
        }

        /*
         * Y un enemigo que ya cayó no sigue moviéndose: el contraataque puede
         * haber sido el golpe final y la torpeza le daba un segundo turno.
         */
        const cronologico = [...nuevas].reverse();
        const cayo = cronologico.findIndex(
          (e) => e.vidaEnemigo !== undefined && e.vidaEnemigo <= 0,
        );
        if (cayo !== -1 && cronologico.slice(cayo + 1).some((e) => e.actor === "eso")) {
          fallo("un enemigo caído no se mueve más");
        }
      }

      /*
       * Lo que dice la pantalla de recompensa tiene que estar en el bolsillo.
       * La bendición armaba el botín para mostrarlo y no lo guardaba: te decía
       * "encontrás algo" y no encontrabas nada. Se ve mirando el bolsillo
       * antes y después, no leyendo el código.
       *
       * Sólo para las salas sin pelea: cuando el combate termina porque tiraste
       * el ácido, el bolsillo baja y sube en el mismo paso y la cuenta no cierra
       * por una razón que no es un bug.
       */
      if (s.fase === "recompensa" && antes.fase !== "recompensa" && a.type !== "combate") {
        const sumados = s.jugador.items.length - antes.jugador.items.length;
        const mostrados = s.botin
          .filter((b) => b.tipo === "item")
          .reduce((t, b) => t + b.cantidad, 0);
        const lleno = antes.jugador.items.length >= 6;
        if (!lleno && sumados !== mostrados) {
          fallo("el botín que se muestra es el que se guarda", `mostró ${mostrados}, guardó ${sumados}`);
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

  /*
   * El margen se calcula, no se elige: unos cuatro errores estándar de una
   * binomial, con un piso para los grupos grandes donde el error tiende a cero.
   *
   * Un umbral fijo no sirve. Con "400 muestras y 6%" se escapaba justo el caso
   * que había: la tirada del miedo al apretar BLOQUEAR anotaba 63% pero sólo
   * aparecía cuando fallaba —el éxito no genera ningún evento, sólo te deja
   * cubierto—, así que ese arco caía del lado bueno el 4,9% de las veces y con
   * 266 muestras el test lo dejaba pasar por poco.
   */
  if (escudosVistos < 20) {
    fallo("se probaron escudos de verdad", `sólo ${escudosVistos} en 1200 partidas`);
  }

  for (const [texto, b] of Object.entries(ruleta)) {
    if (b.n < 120) continue;
    const prob = Number(texto);
    const p = prob / 100;
    const real = (b.salieron / b.n) * 100;
    const margen = Math.max(4, 4 * Math.sqrt((p * (1 - p)) / b.n) * 100);
    if (Math.abs(real - prob) > margen) {
      fallo(
        "la ruleta no miente",
        `dice ${prob}% y sale ${real.toFixed(1)}% en ${b.n} tiradas`,
      );
    }
  }

  if (process.env.RULETA) {
    for (const [prob, b] of Object.entries(ruleta).sort((x,y)=>Number(x[0])-Number(y[0]))) {
      console.log(`    ruleta ${prob}%  n=${b.n}  real=${((b.salieron/b.n)*100).toFixed(1)}%`);
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
    "el botín que se muestra es el que se guarda",
    "morir se ve venir",
    "un bloqueo que sale para el golpe entero",
    "usar no le da el turno al enemigo",
    "un enemigo caído no se mueve más",
    "los porcentajes del combate van de a 5",
    "la ruleta no miente",
    "cada evento del combate dice cómo quedó el enemigo",
    "el enemigo no revive",
    "cubrirse vale para todo el turno",
    "el escudo no se desborda",
    "un estado no se apila consigo mismo",
    "un estado no dura más de lo declarado",
    "el escudo se gasta de a uno",
    "el escudo no se apaga sin decirlo",
    "se probaron escudos de verdad",
  ];
  let todo = true;
  for (const r of REGLAS) {
    const n = fallas[r] ?? 0;
    if (n) todo = false;
    console.log(`  ${n === 0 ? "OK   " : "FALLA"} ${r}${n ? `  (${n}, ej: ${ej[r]})` : ""}`);
  }
  return todo;
}

// --- puertas y minijuegos --------------------------------------------------

/**
 * Estas se prueban con números exactos, no con "algo cambió".
 *
 * Es la lección del café y del segundo aire: dos parches se aplicaron sobre
 * anclas que ya no existían, no rompieron nada visible, y lo único que los
 * agarró fue una prueba que decía "tienen que ser 14, no 12". Un test que
 * pregunta "¿bajó la vida?" habría pasado con el efecto desconectado.
 */
function juegos() {
  const fallas: string[] = [];
  let comprobadas = 0;
  const debe = (regla: string, a: unknown, b: unknown) => {
    comprobadas++;
    if (a !== b) fallas.push(`${regla}: dio ${a}, tenía que dar ${b}`);
  };

  // --- las puertas -----------------------------------------------------
  // Lo que se le muestra al jugador tiene que ser lo que se sortea.
  const repartos = new Set<string>();
  let sinCien = 0;
  let noEntero = 0;
  let noRedondo = 0;
  let sorteoFueraDeLectura = 0;
  /*
   * Un riesgo en múltiplos de 10 se piensa de cabeza caminando el pasillo. La
   * única excepción permitida es la puerta que reparte parejo, que se lee igual
   * de rápido: "acá puede pasar cualquiera".
   */
  const redonda = (probs: number[]) =>
    probs.every((p) => p % 10 === 0) || probs.every((p) => p === 33 || p === 34);

  for (let n = 0; n < 4000; n++) {
    const rng: Rng = { seed: (Math.random() * 1e9) | 0 };
    for (const p of generarPasillo(rng, { cantidadPuertas: 5 }).puertas) {
      if (p.profesor) continue;
      const probs = p.lecturas.map((l) => l.prob);
      if (probs.reduce((t, x) => t + x, 0) !== 100) sinCien++;
      if (probs.some((x) => !Number.isInteger(x))) noEntero++;
      if (!redonda(probs)) noRedondo++;
      if (!p.lecturas.some((l) => l.suceso === p.sorteado)) sorteoFueraDeLectura++;
      repartos.add(p.forma);
    }
  }
  debe("los porcentajes suman 100", sinCien, 0);
  debe("los porcentajes son enteros", noEntero, 0);
  debe("los porcentajes van de a 10, salvo la pareja", noRedondo, 0);
  debe("lo que pasa estaba en la lista", sorteoFueraDeLectura, 0);
  debe("aparecen todas las formas de puerta", repartos.size, FORMAS_PUERTA.length);

  // Y ninguna forma puede prometer algo que no puede cumplir.
  let repartoParejo = 0;
  for (const f of FORMAS_PUERTA) {
    const probs: number[] = [f.reparto.pelea, f.reparto.bendicion, f.reparto.juego].filter(
      (p) => p > 0,
    );
    debe(`la puerta ${f.id} reparte 100`, probs.reduce((t, x) => t + x, 0), 100);
    debe(`la puerta ${f.id} se lee de un vistazo`, redonda(probs), true);
    if (probs.every((p) => p === 33 || p === 34)) repartoParejo++;
  }
  debe("hay una sola puerta que reparte parejo", repartoParejo, 1);

  // --- el pizarrón -----------------------------------------------------
  // 4 de 4 paga 2, 3 de 4 paga 1, 2 de 4 no paga nada.
  const rng: Rng = { seed: 1 };
  const pizarron = (): Minijuego => {
    let j = armarMinijuego(rng, []);
    while (j.tipo !== "pizarron") j = armarMinijuego(rng, []);
    return j;
  };
  const jugarPizarron = (j: Minijuego, aciertos: number) => {
    let e = j;
    for (let i = 0; i < j.secuencia!.length; i++) {
      const bien = j.opcionesSimbolo!.indexOf(j.secuencia![i]);
      const mal = (bien + 1) % j.opcionesSimbolo!.length;
      e = jugar(e, i < aciertos ? bien : mal, rng);
    }
    return e;
  };
  debe("pizarrón 4/4 paga 2", jugarPizarron(pizarron(), 4).premio, 2);
  debe("pizarrón 3/4 paga 1", jugarPizarron(pizarron(), 3).premio, 1);
  debe("pizarrón 2/4 no paga", jugarPizarron(pizarron(), 2).premio, 0);
  debe("el pizarrón termina", jugarPizarron(pizarron(), 4).terminado, true);

  // --- la apuesta ------------------------------------------------------
  const apuesta = (): Minijuego => {
    let j = armarMinijuego(rng, []);
    while (j.tipo !== "apuesta") j = armarMinijuego(rng, []);
    return j;
  };
  const a0 = apuesta();
  debe("la apuesta arranca con 1 juntado", a0.juntado, 1);
  debe("la apuesta arranca con 70 de suerte", a0.suerte, 70);
  debe("irse en el primer paso paga 1", jugar(a0, 0, rng).premio, 1);
  debe("irse cierra el juego", jugar(a0, 0, rng).terminado, true);

  /*
   * Cada paso que sale bien cuesta 15 de suerte, con piso en 25. No se puede
   * encadenar y mirar el final —la racha se corta sola cuando el dado dice que
   * no— así que se prueba la regla paso a paso: se repite el mismo paso hasta
   * que salga bien una vez, y se mira qué devolvió ese.
   */
  const pasoQueSale = (suerte: number) => {
    for (let i = 0; i < 500; i++) {
      const r = jugar({ ...apuesta(), suerte, juntado: 3 }, 1, rng);
      if (!r.terminado) return r;
    }
    throw new Error(`la apuesta nunca salió bien con suerte ${suerte}`);
  };
  debe("de 100 baja a 85", pasoQueSale(100).suerte, 85);
  debe("de 55 baja a 40", pasoQueSale(55).suerte, 40);
  debe("de 40 toca el piso de 25", pasoQueSale(40).suerte, 25);
  debe("el piso no se perfora", pasoQueSale(25).suerte, 25);
  debe("cada paso suma uno", pasoQueSale(100).juntado, 4);
  debe("la racha no termina sola", pasoQueSale(100).terminado, false);
  debe("y se cobra entera al irse", jugar({ ...apuesta(), juntado: 6 }, 0, rng).premio, 6);
  // Perder deja en cero, no en lo que había juntado.
  const perdido = jugar({ ...apuesta(), juntado: 6, suerte: 0 }, 1, rng);
  debe("perder no deja nada", perdido.premio, 0);
  debe("perder cierra el juego", perdido.terminado, true);

  // --- el examen -------------------------------------------------------
  // Sólo existe si hay al menos tres sombras sobre las que preguntar.
  let salioExamen = false;
  for (let i = 0; i < 200; i++) {
    if (armarMinijuego(rng, []).tipo === "examen") salioExamen = true;
  }
  debe("sin sombras no hay examen", salioExamen, false);

  const sombras = Object.keys(ENEMIGOS).filter((id) => !id.startsWith("prof_")).slice(0, 4);
  const examen = (): Minijuego => {
    let j = armarMinijuego(rng, sombras);
    while (j.tipo !== "examen") j = armarMinijuego(rng, sombras);
    return j;
  };
  const ex = examen();
  debe("el examen ofrece tres opciones", ex.opciones!.length, 3);
  debe("las tres opciones son distintas", new Set(ex.opciones).size, 3);
  debe("acertar paga 2", jugar(ex, ex.correcta!, rng).premio, 2);
  debe("errar no paga", jugar(ex, (ex.correcta! + 1) % 3, rng).premio, 0);
  debe("pregunta por algo que venciste", sombras.includes(ex.enemigoId!), true);

  // --- el premio -------------------------------------------------------
  // Igual que el botín de un combate: nunca sale de otra materia.
  let ajenos = 0;
  for (const m of Object.keys(MATERIAS)) {
    for (const id of premioDe(rng, m, 50)) {
      if (!MATERIAS[m].items.includes(id)) ajenos++;
    }
  }
  debe("el premio es de la materia del aula", ajenos, 0);

  /*
   * Todo item se dibuja: en el bolsillo, en la recompensa, y sobre todo en el
   * umbral, donde aparece grande y solo. Un item sin ícono no se ve feo, rompe
   * la pantalla — `Pixeles` lee `data[0].length` de un undefined.
   */
  debe(
    "todo item tiene su ícono",
    ITEM_IDS.filter((id) => !ICONOS_ITEM[id]).join(",") || "ninguno falta",
    "ninguno falta",
  );
  debe("premio de 0 no da nada", premioDe(rng, "biologia", 0).length, 0);
  debe("premio de 2 da dos", premioDe(rng, "biologia", 2).length, 2);

  /*
   * Los números de donde salen esos porcentajes, en el contenido. Redondos acá
   * es la única forma de que sigan redondos después de restarles el miedo y el
   * desgaste del arma.
   */
  const deACinco = (v: number) => Math.abs(Math.round(v * 20) - v * 20) < 1e-9;
  const sueltos: string[] = [];
  for (const e of Object.values(ENEMIGOS)) {
    for (const i of e.patron) {
      if (i.precision !== undefined && !deACinco(i.precision)) {
        sueltos.push(`${e.id}:${i.precision}`);
      }
    }
  }
  for (const a of Object.values(ARMAS)) {
    for (const [k, v] of [
      ["precision", a.precision],
      ["desgaste", a.desgaste],
      ["critico", a.critico],
      ["perdida", a.perdida ?? 0],
    ] as const) {
      if (!deACinco(v)) sueltos.push(`${a.id}.${k}:${v}`);
    }
  }
  for (const i of Object.values(ITEMS)) {
    if (!deACinco(i.precision)) sueltos.push(`${i.id}:${i.precision}`);
  }
  for (const [id, po] of Object.entries(PODERES)) {
    if (!deACinco(po.precision)) sueltos.push(`${id}:${po.precision}`);
    const cp = po.pasivo?.contraPrecision;
    if (cp !== undefined && !deACinco(cp)) sueltos.push(`${id}.contra:${cp}`);
  }
  debe("todo el contenido va de a 5", sueltos.join(",") || "todo redondo", "todo redondo");

  for (const f of fallas) console.log(`  FALLA ${f}`);
  if (!fallas.length) console.log(`  OK    puertas y minijuegos (${comprobadas} números exactos)`);
  return fallas.length === 0;
}

// --- cli -------------------------------------------------------------------

const que = process.argv[2];

if (!que || que === "estilos") {
  console.log(`\nESTILOS  (${CORRIDAS} runs cada uno)`);
  for (const e of ESTILOS) correr(e);
  avisarCortes();
}
if (!que || que === "reglas") {
  console.log("\nINVARIANTES");
  // Las dos siempre, sin cortocircuito: si una falla quiero ver la otra igual.
  const a = reglas();
  const ok = juegos() && a;
  console.log(ok ? "\n  todas se cumplen" : "\n  HAY REGLAS ROTAS");
  if (!ok) process.exitCode = 1;
}
