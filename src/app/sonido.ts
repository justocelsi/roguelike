/**
 * El sonido del juego, sintetizado. **Sin un solo archivo.**
 *
 * Es la misma decisión que los sprites: igual que el pixel art son grillas de
 * texto renderizadas en CSS, acá cada sonido son cuatro osciladores y una
 * envolvente. No hay descargas, no hay pipeline de assets, y el repo pesa lo
 * mismo con sonido que sin él.
 *
 * El tono lo pone la ambientación, no el volumen. Todo es corto, seco y
 * grave —ondas cuadradas y ruido filtrado, nada de instrumentos— porque el
 * colegio de este juego está en silencio y lo que se escucha son cosas
 * puntuales pasando cerca tuyo. Un sonido que dura más que su evento se
 * convierte en música, y la música acá sobraría.
 *
 * Los navegadores no dejan sonar hasta que el jugador toca algo, así que el
 * contexto se crea en el primer gesto: apretar ENTRAR.
 */

type Nombre =
  | "golpe"
  | "arma"
  | "recibis"
  | "bloqueo"
  | "fallo"
  | "tic"
  | "umbral"
  | "revelar"
  | "enemigo"
  | "muere"
  | "escudo"
  | "hallazgo"
  | "estado"
  | "latido"
  | "boton";

let ctx: AudioContext | null = null;
let maestro: GainNode | null = null;
let mudo = false;

const CLAVE = "vigilia:mudo";

/** Se llama en el primer gesto del jugador. Antes de eso no se puede sonar. */
export function despertarSonido() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    maestro = ctx.createGain();
    maestro.gain.value = 0.32;
    maestro.connect(ctx.destination);
    if (typeof localStorage !== "undefined") {
      mudo = localStorage.getItem(CLAVE) === "1";
    }
  } catch {
    // Sin audio el juego se juega igual. No es un error que valga contar.
    ctx = null;
  }
}

export function estaMudo() {
  return mudo;
}

export function alternarMudo(): boolean {
  mudo = !mudo;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLAVE, mudo ? "1" : "0");
  }
  return mudo;
}

// --- la caja de herramientas ----------------------------------------------

/**
 * Un tono con caída exponencial. `desde`/`hasta` hacen el glissando: casi todo
 * lo que suena en el juego cae de agudo a grave, que es cómo suena algo que
 * pierde energía.
 */
function tono(
  t: number,
  o: {
    desde: number;
    hasta?: number;
    dur: number;
    vol?: number;
    tipo?: OscillatorType;
    retraso?: number;
  },
) {
  if (!ctx || !maestro) return;
  const inicio = t + (o.retraso ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.tipo ?? "square";
  osc.frequency.setValueAtTime(o.desde, inicio);
  if (o.hasta && o.hasta !== o.desde) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.hasta), inicio + o.dur);
  }
  const v = o.vol ?? 0.3;
  // Un ataque de 4 ms en vez de instantáneo: cortar en seco hace un chasquido
  // que se escucha más que la nota.
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(v, inicio + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + o.dur);
  osc.connect(g).connect(maestro);
  osc.start(inicio);
  osc.stop(inicio + o.dur + 0.02);
}

/** Ruido filtrado: los impactos, los cristales, todo lo que no tiene altura. */
function ruido(
  t: number,
  o: { dur: number; vol?: number; corte?: number; tipo?: BiquadFilterType; retraso?: number },
) {
  if (!ctx || !maestro) return;
  const inicio = t + (o.retraso ?? 0);
  const n = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filtro = ctx.createBiquadFilter();
  filtro.type = o.tipo ?? "lowpass";
  filtro.frequency.value = o.corte ?? 900;
  const g = ctx.createGain();
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(v, inicio);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + o.dur);
  src.connect(filtro).connect(g).connect(maestro);
  src.start(inicio);
  src.stop(inicio + o.dur + 0.02);
}

// --- el catálogo ------------------------------------------------------------

/**
 * Cada sonido está escrito para leerse de oído sin mirar la pantalla: lo tuyo
 * sube, lo del enemigo baja, lo que se rompe es cristal y lo que falla es un
 * golpe sordo que no llega a ningún lado.
 */
export function sonar(que: Nombre) {
  if (!ctx || !maestro || mudo) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;

  switch (que) {
    // Lo tuyo, seco y con cuerpo.
    case "golpe":
      ruido(t, { dur: 0.09, vol: 0.34, corte: 1500 });
      tono(t, { desde: 180, hasta: 70, dur: 0.11, vol: 0.26, tipo: "triangle" });
      break;
    // El arma pega más y suena más abajo: se nota sin leer el número.
    case "arma":
      ruido(t, { dur: 0.13, vol: 0.4, corte: 2400 });
      tono(t, { desde: 240, hasta: 55, dur: 0.18, vol: 0.32, tipo: "sawtooth" });
      break;
    // Lo del enemigo entra en tu cuerpo: más grave, más largo, más sucio.
    case "recibis":
      ruido(t, { dur: 0.22, vol: 0.45, corte: 600 });
      tono(t, { desde: 120, hasta: 38, dur: 0.3, vol: 0.34, tipo: "sawtooth" });
      break;
    // Metal contra metal. Dos cuadradas desafinadas entre sí.
    case "bloqueo":
      tono(t, { desde: 900, hasta: 620, dur: 0.09, vol: 0.2 });
      tono(t, { desde: 1340, hasta: 900, dur: 0.07, vol: 0.14 });
      ruido(t, { dur: 0.06, vol: 0.16, corte: 3800, tipo: "highpass" });
      break;
    // Errar no suena a nada: eso es lo que pasó.
    case "fallo":
      ruido(t, { dur: 0.16, vol: 0.16, corte: 380 });
      break;
    // La aguja del reloj. Cortísimo, o treinta juntos son un zumbido.
    case "tic":
      ruido(t, { dur: 0.012, vol: 0.13, corte: 5200, tipo: "highpass" });
      break;
    // La puerta abriéndose: algo grave que sube mientras sube la luz.
    case "umbral":
      tono(t, { desde: 42, hasta: 150, dur: 1.5, vol: 0.16, tipo: "sine" });
      ruido(t, { dur: 1.3, vol: 0.1, corte: 340 });
      break;
    // Y lo que hay adentro, tomando forma.
    case "revelar":
      tono(t, { desde: 320, hasta: 190, dur: 0.5, vol: 0.16, tipo: "triangle" });
      tono(t, { desde: 213, hasta: 127, dur: 0.6, vol: 0.11, tipo: "sine", retraso: 0.05 });
      break;
    /*
     * Y si lo que hay adentro es alguien. Dos tonos separados por un tritono
     * —el intervalo que la música medieval llamaba «el diablo»— que es lo más
     * parecido a una amenaza que se puede hacer con dos osciladores.
     */
    case "enemigo":
      tono(t, { desde: 150, hasta: 98, dur: 0.75, vol: 0.2, tipo: "sawtooth" });
      tono(t, { desde: 212, hasta: 139, dur: 0.75, vol: 0.13, tipo: "sawtooth", retraso: 0.06 });
      ruido(t, { dur: 0.5, vol: 0.1, corte: 500 });
      break;

    // Algo que se desarma y cae.
    case "muere":
      tono(t, { desde: 300, hasta: 30, dur: 0.55, vol: 0.3, tipo: "sawtooth" });
      ruido(t, { dur: 0.4, vol: 0.24, corte: 900, retraso: 0.08 });
      break;
    // Cristal: agudo, disperso, y nada abajo que lo sostenga.
    case "escudo":
      for (let i = 0; i < 6; i++) {
        tono(t, {
          desde: 2100 + i * 640,
          hasta: 1500 + i * 380,
          dur: 0.16 + i * 0.02,
          vol: 0.075,
          retraso: i * 0.022,
        });
      }
      ruido(t, { dur: 0.3, vol: 0.16, corte: 4200, tipo: "highpass", retraso: 0.03 });
      break;
    // Lo único que sube: encontrar algo.
    case "hallazgo":
      tono(t, { desde: 520, hasta: 528, dur: 0.14, vol: 0.2, tipo: "triangle" });
      tono(t, { desde: 784, hasta: 792, dur: 0.24, vol: 0.16, tipo: "triangle", retraso: 0.09 });
      break;
    // Un estado encima tuyo. Desafinado a propósito: no termina de cerrar.
    case "estado":
      tono(t, { desde: 420, hasta: 300, dur: 0.5, vol: 0.18, tipo: "sine" });
      tono(t, { desde: 445, hasta: 316, dur: 0.5, vol: 0.14, tipo: "sine" });
      break;
    // Dos golpes de corazón. Sólo cuando estás por morir.
    case "latido":
      tono(t, { desde: 68, hasta: 40, dur: 0.16, vol: 0.4, tipo: "sine" });
      tono(t, { desde: 60, hasta: 36, dur: 0.22, vol: 0.3, tipo: "sine", retraso: 0.21 });
      break;
    case "boton":
      tono(t, { desde: 620, hasta: 500, dur: 0.035, vol: 0.1 });
      break;
  }
}

// --- la ruleta --------------------------------------------------------------

/** Evalúa una curva cubic-bezier de CSS. Devuelve y para un x dado. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (px: number) => {
    // Newton alcanza y sobra para una curva monótona como ésta.
    let t = px;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - px;
      const d = dx(t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/**
 * Los tics de la aguja del reloj.
 *
 * Es el sonido que más trabaja del juego: la aguja arranca disparada y frena
 * de a poco, así que los tics empiezan pegados y se van separando hasta que
 * queda uno solo, colgado, justo antes de que pare. Ese último silencio es toda
 * la tensión de la tirada.
 *
 * Se calcula con la **misma curva** que usa el CSS para mover la aguja: se
 * recorre el tiempo y se emite un tic cada vez que el ángulo cruza una marca
 * del reloj. Si las dos curvas no fueran la misma, el sonido y la imagen se
 * separarían y se notaría enseguida.
 */
export function ticsDeReloj(
  duracionMs: number,
  gradosTotales: number,
  curva: [number, number, number, number],
): number[] {
  const f = bezier(...curva);
  const GRADOS_POR_MARCA = 30;
  const tiempos: number[] = [];
  let marca = 1;
  const pasos = 240;
  for (let i = 1; i <= pasos; i++) {
    const ms = (i / pasos) * duracionMs;
    const grados = f(i / pasos) * gradosTotales;
    while (grados >= marca * GRADOS_POR_MARCA) {
      tiempos.push(ms);
      marca++;
    }
  }
  return tiempos;
}
