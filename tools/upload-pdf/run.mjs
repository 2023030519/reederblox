// Uploads PDFs to one of your titles from this computer. One long PDF becomes chapters of N pages ("Parte 1"…);
// several PDFs or a folder of them become one chapter each, ordered by file name the way the Explorer sorts
// (2 before 10) and shown to you for confirmation before anything is sent. It does not depend on a browser tab
// or a phone staying awake, and it resumes like the Studio does: run the same command again and finished
// chapters are skipped and a half-uploaded one continues after its last saved page.
//
//   node tools/upload-pdf/run.mjs <archivo.pdf> --obra <slug-o-id> [--desde 1] [--por-parte 100] [--titulo "..."] [--borrador]
//   node tools/upload-pdf/run.mjs <carpeta | varios.pdf...> --obra <slug-o-id> [--desde 1] [--titulo "Capitulo 13"] [--borrador]
//     Con varios PDFs, --titulo es la base del nombre: "Capitulo 13" → Capitulo 13, Capitulo 14, … y si no das
//     --desde, los números de capítulo también arrancan en 13. Sin --titulo, el nombre es el del archivo.
//   node tools/upload-pdf/run.mjs <archivo-o-carpeta> --seco      only converts/lists, uploads nothing
//   --sustituir   replaces a colliding UNPUBLISHED draft chapter (leftover from an interrupted attempt)
//
// It asks for your readerblox email and password in the terminal (the password is not shown or saved).
// Same rules as NewChapter in app/studio/[id]/page.tsx; keep them in step.
import { createClient } from "@supabase/supabase-js";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
let files = args.filter((a, i) => !a.startsWith("--") && !["--obra", "--desde", "--por-parte", "--titulo"].includes(args[i - 1]));
if (files.length === 1 && fs.existsSync(files[0]) && fs.statSync(files[0]).isDirectory())
  files = fs.readdirSync(files[0]).filter((f) => /\.pdf$/i.test(f)).map((f) => path.join(files[0], f));
files.sort(new Intl.Collator("es", { numeric: true }).compare); // natural order: "cap 2" before "cap 10"
const MULTI = files.length > 1;
const DRY = args.includes("--seco");
const SLUG = opt("--obra");
const NAME = opt("--titulo", "");
const nameNum = MULTI ? NAME.match(/(\d+)\s*$/)?.[1] : null; // "Capitulo 13" → names count from 13 and --desde defaults to 13
const START = Number(opt("--desde", nameNum ?? 1));
const SIZE = Math.max(1, Math.floor(Number(opt("--por-parte", 100))) || 100);
const PUBLISH = !args.includes("--borrador");
const REPLACE = args.includes("--sustituir"); // replace colliding UNPUBLISHED drafts (leftovers from another attempt)
const MAX_W = 1600, QUALITY = 80; // same as the browser upload (toWebp / lib/pdf)
const log = (...m) => console.log(new Date().toLocaleTimeString(), ...m);
const fail = (m) => { console.error(`\n${m}`); process.exit(1); };

if (!files.length || files.some((f) => !fs.existsSync(f)))
  fail("Uso: node tools/upload-pdf/run.mjs <archivo.pdf | carpeta | varios.pdf> --obra <slug-o-id> [--desde 1] [--por-parte 100]");
if (!DRY && !SLUG) fail("Falta --obra: el slug de la obra (lo que sale en /title/<slug>) o su id del Estudio.");
if (!DRY && !(START >= 0)) fail("--desde debe ser un número.");

function ask(q, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? q : "");
  return new Promise((r) => rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); r(a.trim()); }));
}

// ---- the PDF(s) ----------------------------------------------------------------------------------------------------
const openPdf = (f) => pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)), verbosity: 0 }).promise
  .catch(() => fail(`${f}: no es un PDF válido`));

async function render(doc, n) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: MAX_W / page.getViewport({ scale: 1 }).width });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), canvas, viewport }).promise;
  page.cleanup();
  return { body: await canvas.encode("webp", QUALITY), width: canvas.width, height: canvas.height };
}

let doc, total, parts; // single-PDF mode only
const multiName = (k) => NAME
  ? (nameNum ? NAME.replace(/\d+\s*$/, "") + (Number(nameNum) + k) : `${NAME} ${START + k}`)
  : path.basename(files[k], path.extname(files[k]));
if (MULTI) {
  if (args.includes("--por-parte")) log("Con varios PDFs cada archivo es un capítulo completo: --por-parte se ignora.");
  console.log(`\n${files.length} PDFs → capítulos ${START} al ${START + files.length - 1}, en este orden:`);
  files.forEach((f, i) => console.log(`  capítulo ${String(START + i).padStart(3)}  "${multiName(i)}"  ←  ${path.basename(f)}`));
  console.log("(orden natural por nombre de archivo, como el Explorador: 2 antes que 10; renombra si está mal)\n");
  if (DRY) { log("Nada se subió (--seco)."); process.exit(0); }
  if (!/^s/i.test(await ask("¿Es este el orden correcto? (s/n) "))) fail("Cancelado. Nada se subió.");
} else {
  doc = await openPdf(files[0]);
  total = doc.numPages;
  parts = Math.ceil(total / SIZE);
  log(`${files[0]}: ${total} páginas → ${parts} parte(s) de hasta ${SIZE}`);
  if (DRY) {
    for (const n of [1, Math.ceil(total / 2), total].filter((n, i, a) => a.indexOf(n) === i)) {
      const r = await render(doc, n);
      log(`página ${n}: ${r.width}×${r.height}, ${(r.body.length / 1024).toFixed(0)} KB en WebP`);
    }
    log("El PDF se puede convertir. Nada se subió (--seco).");
    process.exit(0);
  }
}

// ---- login and title ---------------------------------------------------------------------------------------------
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split("=")).map(([k, ...v]) => [k.trim(), v.join("=").trim()]));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = await ask("Correo de readerblox: ");
const password = await ask("Contraseña: ", true);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) fail(`No se pudo entrar: ${authError.message}`);
const uid = auth.user.id;

const nChaps = MULTI ? files.length : parts;
const isId = /^[0-9a-f-]{36}$/i.test(SLUG);
const { data: title } = await supabase.from("titles").select("id,name").eq("owner_id", uid).eq(isId ? "id" : "slug", SLUG).maybeSingle();
if (!title) fail(`No encontré una obra tuya con ${isId ? "id" : "slug"} "${SLUG}".`);
log(`Obra: ${title.name}. Capítulos del ${START} al ${START + nChaps - 1}${PUBLISH ? ", se publican al terminar" : ", quedan como borrador"}.`);

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const { data: rows, error: listError } = await supabase.from("chapters").select("id,number,name,is_published,pages(count)").eq("title_id", title.id);
if (listError) fail(listError.message);
const existing = new Map(rows.map((c) => [Number(c.number), c]));
const publish = (id) => supabase.from("chapters").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", id).select().then(must);

// ---- upload --------------------------------------------------------------------------------------------------------
let skipped = 0;
process.on("unhandledRejection", (e) => fail(`Se detuvo: ${e?.message ?? e}
Vuelve a correr el mismo comando para continuar donde se quedó.`));

// Uploads pages from..from+len-1 of doc as chapter num; returns false if it was already complete.
async function uploadChapter(doc, num, chName, from, len, label) {
  let had = existing.get(num);
  // A draft with another name is a leftover no reader ever saw; --sustituir deletes it and uploads fresh.
  if (had && !had.is_published && had.name !== chName && REPLACE) {
    const folder = `${uid}/${title.id}/${had.id}`;
    const old = (must(await supabase.storage.from("media").list(folder, { limit: 1000 })) ?? []).map((f) => `${folder}/${f.name}`);
    if (old.length) must(await supabase.storage.from("media").remove(old));
    must(await supabase.from("chapters").delete().eq("id", had.id).select()); // pages cascade
    log(`${label}: borrador anterior del capítulo ${num} reemplazado`);
    had = undefined;
  }
  const saved = had?.pages[0]?.count ?? 0;
  if (had && had.name === chName && saved === len) { // finished on an earlier run
    if (PUBLISH && !had.is_published) await publish(had.id);
    return false;
  }
  if (had && !(had.name === chName && !had.is_published))
    fail(`Ya existe un capítulo con el número ${num} (${had.name ?? "sin título"}, ${had.is_published ? "publicado: usa otro --desde" : "borrador: corre con --sustituir para reemplazarlo"}).`);

  let id = had?.id;
  if (!id) id = must(await supabase.from("chapters").insert({ title_id: title.id, number: num, name: chName }).select("id").single()).id;
  const folder = `${uid}/${title.id}/${id}`;
  if (saved) {
    // An image may have been sent without its row: drop files past the last saved page so they can be sent again.
    const extra = (must(await supabase.storage.from("media").list(folder, { limit: 1000 })) ?? []).filter((f) => parseInt(f.name) > saved).map((f) => `${folder}/${f.name}`);
    if (extra.length) must(await supabase.storage.from("media").remove(extra));
    log(`${label}: continúa desde la página ${saved + 1} de ${len}`);
  }
  // shortcut: one page at a time, so "pages saved" is always 1..n with no gaps; parallel uploads would be faster.
  for (let i = saved; i < len; i++) {
    const { body, width, height } = await render(doc, from + i);
    const image_path = `${folder}/${i + 1}.webp`;
    must(await supabase.storage.from("media").upload(image_path, body, { contentType: "image/webp", upsert: false }));
    must(await supabase.from("pages").insert({ chapter_id: id, position: i + 1, image_path, width, height }).select());
    process.stdout.write(`\r${new Date().toLocaleTimeString()} ${label} · página ${i + 1} de ${len}   `);
  }
  if (PUBLISH) await publish(id);
  process.stdout.write("\n");
  log(`${label} lista (capítulo ${num}).`);
  return true;
}

if (MULTI) {
  for (let k = 0; k < files.length; k++) {
    const d = await openPdf(files[k]);
    const chName = multiName(k);
    if (!(await uploadChapter(d, START + k, chName, 1, d.numPages, `${chName} (${k + 1} de ${files.length})`))) skipped++;
    await d.destroy();
  }
} else {
  for (let k = 0; k < parts; k++) {
    const num = START + k, from = k * SIZE + 1, len = Math.min(SIZE, total - k * SIZE);
    const chName = [NAME, parts > 1 ? `Parte ${k + 1}` : ""].filter(Boolean).join(" · ") || null;
    if (!(await uploadChapter(doc, num, chName, from, len, `Parte ${k + 1} de ${parts}`))) skipped++;
  }
  await doc.destroy();
}
log(`Listo: ${nChaps - skipped} subida(s)${skipped ? `, ${skipped} ya estaban completas` : ""}.`);
process.exit(0);
