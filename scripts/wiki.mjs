#!/usr/bin/env node
/**
 * Scraper de wikis para buscar inspiración de mecánicas.
 *
 * Fandom bloquea el scraping directo del HTML (403) pero deja abierta la API
 * de MediaWiki, que además devuelve el wikitexto crudo — más limpio de parsear
 * que el HTML renderizado.
 *
 *   node scripts/wiki.mjs                    todas las wikis
 *   node scripts/wiki.mjs slay-the-spire     una sola
 *   node scripts/wiki.mjs --lista            qué hay configurado
 *   node scripts/wiki.mjs --fresco           ignora el caché
 *
 * Sale a research/, que está fuera de git: el contenido de Fandom es CC-BY-SA
 * y esto es material de consulta, no algo para redistribuir.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SALIDA = "research";
const CACHE = "research/.cache";
/** Fandom no publica un límite; medio segundo entre pedidos es cortés. */
const ESPERA_MS = 500;
const MAX_PAGINAS = 14;

/**
 * Cada wiki con lo que nos interesa de ella. `paginas` son títulos exactos;
 * `buscar` son términos por si los títulos cambiaron o no los sabemos.
 */
const WIKIS = [
  {
    id: "slay-the-spire",
    host: "slay-the-spire.fandom.com",
    nombre: "Slay the Spire",
    porQue:
      "El mejor catálogo de intenciones de enemigo y de reliquias con contrapartida.",
    paginas: ["Relics", "Potions", "Status Effects", "Powers", "Curses"],
    buscar: ["enemy intent", "relic drawback"],
  },
  {
    id: "darkestdungeon",
    host: "darkestdungeon.fandom.com",
    nombre: "Darkest Dungeon",
    porQue:
      "Estados de estrés y aflicciones: conecta una mecánica con una idea psicológica, que es lo nuestro con el insomnio.",
    paginas: ["Afflictions", "Stress", "Quirks", "Diseases", "Virtues"],
    buscar: ["affliction", "stress"],
  },
  {
    id: "inscryption",
    host: "inscryption.fandom.com",
    nombre: "Inscryption",
    porQue:
      "Objetos y reglas que rompen la interfaz, como nuestra confusión que miente los números.",
    paginas: ["Items", "Sigils", "Bosses"],
    buscar: ["sigil", "item"],
  },
  {
    id: "deadcells",
    host: "deadcells.fandom.com",
    nombre: "Dead Cells",
    porQue: "Mutaciones con costo: muy cerca de nuestro poder/defecto.",
    paginas: ["Mutations", "Malaise", "Curse"],
    buscar: ["mutation", "status effect"],
  },
  {
    id: "enterthegungeon",
    host: "enterthegungeon.fandom.com",
    nombre: "Enter the Gungeon",
    porQue:
      "Sinergias: dos objetos que juntos hacen una tercera cosa. Es lo que más profundidad le daría a la reserva escasa.",
    paginas: ["Synergies", "Items", "Curse"],
    buscar: ["synergy", "passive item"],
  },
  {
    id: "soul-knight",
    host: "soul-knight.fandom.com",
    nombre: "Soul Knight",
    porQue: "Trece estados con reglas de apilado y de duración contra jefes.",
    paginas: ["Status Effects", "Buffs", "Modifiers", "Potions"],
    buscar: ["debuff"],
  },
  {
    id: "noskin",
    host: "noskin.fandom.com",
    nombre: "NO-SKIN",
    porQue: "La referencia directa: salas, consumibles y eventos con elección.",
    paginas: [
      "Consumables",
      "Rooms",
      "Special Room Events",
      "The Black Market",
      "Sharp Knives",
      "Endings",
    ],
    buscar: ["upgrade"],
  },
];

// --- API ------------------------------------------------------------------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params) {
  const url = `https://${host}/api.php?${new URLSearchParams({
    ...params,
    format: "json",
  })}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buscarTitulos(host, termino, limite = 5) {
  const d = await api(host, {
    action: "query",
    list: "search",
    srsearch: termino,
    srlimit: String(limite),
  });
  return (d.query?.search ?? []).map((r) => r.title);
}

async function wikitexto(host, titulo) {
  const d = await api(host, {
    action: "parse",
    page: titulo,
    prop: "wikitext",
    redirects: "1",
  });
  return d.parse?.wikitext?.["*"] ?? "";
}

// --- limpieza del wikitexto ----------------------------------------------

/**
 * Las tablas son donde vive lo bueno (items con su descripción y sus números),
 * así que en vez de tirarlas se aplanan a una fila de texto por entrada.
 */
function aplanarTablas(w) {
  return w.replace(/\{\|[\s\S]*?\n\|\}/g, (tabla) => {
    const filas = tabla
      .split(/\n\|-[^\n]*/)
      .slice(1)
      .map((fila) =>
        fila
          .split(/\n[!|]/)
          .map((c) => c.replace(/^[^|]*\|(?!\|)/, "").trim())
          .filter((c) => c && !/^(colspan|rowspan|style|class)/.test(c))
          .join(" · "),
      )
      .filter((f) => f.length > 3);
    return filas.length ? "\n" + filas.map((f) => `- ${f}`).join("\n") + "\n" : "";
  });
}

function limpiar(w) {
  let t = w;
  t = t.replace(/<ref[\s\S]*?<\/ref>/g, "");
  t = t.replace(/\[\[(?:File|Image|Archivo):[^\]]*\]\]/gi, "");
  t = aplanarTablas(t);
  // Plantillas: se conserva el último argumento, que suele ser el nombre.
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\{\{([^{}]*)\}\}/g, (_, dentro) => {
      const partes = dentro.split("|").map((s) => s.trim());
      const ultimo = partes[partes.length - 1];
      return /^\d*$/.test(ultimo) ? partes[0] ?? "" : ultimo;
    });
  }
  t = t.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
  t = t.replace(/'''?/g, "");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/^\s*[!|].*$/gm, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

// --- scraping -------------------------------------------------------------

async function traer(host, titulo, fresco) {
  const archivo = path.join(CACHE, `${host}__${titulo.replace(/[^\w]/g, "_")}.txt`);
  if (!fresco && existsSync(archivo)) return readFile(archivo, "utf8");
  const crudo = await wikitexto(host, titulo);
  await writeFile(archivo, crudo);
  await dormir(ESPERA_MS);
  return crudo;
}

async function scrapear(wiki, fresco) {
  const titulos = [...wiki.paginas];
  for (const termino of wiki.buscar ?? []) {
    try {
      for (const t of await buscarTitulos(wiki.host, termino)) {
        if (!titulos.includes(t)) titulos.push(t);
      }
      await dormir(ESPERA_MS);
    } catch {
      /* la búsqueda es un extra: si falla seguimos con los títulos fijos */
    }
  }

  const partes = [
    `# ${wiki.nombre}`,
    "",
    `> ${wiki.porQue}`,
    "",
    `Fuente: https://${wiki.host} — contenido bajo CC-BY-SA.`,
    "",
  ];
  let ok = 0;
  for (const titulo of titulos.slice(0, MAX_PAGINAS)) {
    try {
      const texto = limpiar(await traer(wiki.host, titulo, fresco));
      if (texto.length < 80) {
        console.log(`   · ${titulo} (vacía)`);
        continue;
      }
      partes.push(`\n## ${titulo}\n`, texto);
      ok++;
      console.log(`   ✓ ${titulo} (${texto.length} car.)`);
    } catch (e) {
      console.log(`   ✗ ${titulo}: ${e.message}`);
    }
  }

  await writeFile(path.join(SALIDA, `${wiki.id}.md`), partes.join("\n"));
  return ok;
}

// --- cli ------------------------------------------------------------------

const args = process.argv.slice(2);
const fresco = args.includes("--fresco");
const pedidas = args.filter((a) => !a.startsWith("--"));

if (args.includes("--lista")) {
  for (const w of WIKIS) console.log(`${w.id.padEnd(18)} ${w.nombre} — ${w.porQue}`);
  process.exit(0);
}

await mkdir(CACHE, { recursive: true });
const objetivo = pedidas.length
  ? WIKIS.filter((w) => pedidas.includes(w.id))
  : WIKIS;

if (!objetivo.length) {
  console.error(`No conozco esa wiki. Probá con --lista.`);
  process.exit(1);
}

let total = 0;
for (const w of objetivo) {
  console.log(`\n${w.nombre} (${w.host})`);
  try {
    total += await scrapear(w, fresco);
  } catch (e) {
    console.log(`   ✗ la wiki entera falló: ${e.message}`);
  }
}
console.log(`\n${total} páginas en ${SALIDA}/`);
