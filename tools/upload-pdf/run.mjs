// Uploads a long PDF to one of your titles from this computer, as chapters of N pages ("Parte 1", "Parte 2"…).
// It does not depend on a browser tab or a phone staying awake, and it resumes like the Studio does: run the same
// command again and finished parts are skipped and a half-uploaded part continues after its last saved page.
//
//   node tools/upload-pdf/run.mjs <archivo.pdf> --obra <slug-o-id> [--desde 1] [--por-parte 100] [--titulo "..."] [--borrador]
//   node tools/upload-pdf/run.mjs <archivo.pdf> --seco      only opens the PDF and converts 3 pages, uploads nothing
//
// It asks for your readerblox email and password in the terminal (the password is not shown or saved).
// Same rules as NewChapter in app/studio/[id]/page.tsx; keep them in step.
import { createClient } from "@supabase/supabase-js";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
import readline from "node:readline";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const file = args.find((a, i) => !a.startsWith("--") && !["--obra", "--desde", "--por-parte", "--titulo"].includes(args[i - 1]));
const DRY = args.includes("--seco");
const SLUG = opt("--obra");
const START = Number(opt("--desde", 1));
const SIZE = Math.max(1, Math.floor(Number(opt("--por-parte", 100))) || 100);
const NAME = opt("--titulo", "");
const PUBLISH = !args.includes("--borrador");
const MAX_W = 1600, QUALITY = 80; // same as the browser upload (toWebp / lib/pdf)
const log = (...m) => console.log(new Date().toLocaleTimeString(), ...m);
const fail = (m) => { console.error(`\n${m}`); process.exit(1); };

if (!file || !fs.existsSync(file)) fail("Uso: node tools/upload-pdf/run.mjs <archivo.pdf> --obra <slug-o-id> [--desde 1] [--por-parte 100]");
if (!DRY && !SLUG) fail("Falta --obra: el slug de la obra (lo que sale en /title/<slug>) o su id del Estudio.");
if (!DRY && !(START >= 0)) fail("--desde debe ser un número.");

function ask(q, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? q : "");
  return new Promise((r) => rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); r(a.trim()); }));
}

// ---- the PDF ------------------------------------------------------------------------------------------------------
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise
  .catch(() => fail(`${file}: no es un PDF válido`));
const total = doc.numPages;
const parts = Math.ceil(total / SIZE);

async function render(n) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: MAX_W / page.getViewport({ scale: 1 }).width });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), canvas, viewport }).promise;
  page.cleanup();
  return { body: await canvas.encode("webp", QUALITY), width: canvas.width, height: canvas.height };
}

log(`${file}: ${total} páginas → ${parts} parte(s) de hasta ${SIZE}`);
if (DRY) {
  for (const n of [1, Math.ceil(total / 2), total].filter((n, i, a) => a.indexOf(n) === i)) {
    const r = await render(n);
    log(`página ${n}: ${r.width}×${r.height}, ${(r.body.length / 1024).toFixed(0)} KB en WebP`);
  }
  log("El PDF se puede convertir. Nada se subió (--seco).");
  process.exit(0);
}

// ---- login and title ---------------------------------------------------------------------------------------------
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split("=")).map(([k, ...v]) => [k.trim(), v.join("=").trim()]));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = await ask("Correo de readerblox: ");
const password = await ask("Contraseña: ", true);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) fail(`No se pudo entrar: ${authError.message}`);
const uid = auth.user.id;

const isId = /^[0-9a-f-]{36}$/i.test(SLUG);
const { data: title } = await supabase.from("titles").select("id,name").eq("owner_id", uid).eq(isId ? "id" : "slug", SLUG).maybeSingle();
if (!title) fail(`No encontré una obra tuya con ${isId ? "id" : "slug"} "${SLUG}".`);
log(`Obra: ${title.name}. Capítulos del ${START} al ${START + parts - 1}${PUBLISH ? ", se publican al terminar" : ", quedan como borrador"}.`);

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const { data: rows, error: listError } = await supabase.from("chapters").select("id,number,name,is_published,pages(count)").eq("title_id", title.id);
if (listError) fail(listError.message);
const existing = new Map(rows.map((c) => [Number(c.number), c]));
const publish = (id) => supabase.from("chapters").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", id).select().then(must);

// ---- upload --------------------------------------------------------------------------------------------------------
let skipped = 0;
process.on("unhandledRejection", (e) => fail(`Se detuvo: ${e?.message ?? e}
Vuelve a correr el mismo comando para continuar donde se quedó.`));
for (let k = 0; k < parts; k++) {
  const num = START + k, from = k * SIZE + 1, len = Math.min(SIZE, total - k * SIZE);
  const chName = [NAME, parts > 1 ? `Parte ${k + 1}` : ""].filter(Boolean).join(" · ") || null;
  const had = existing.get(num);
  const saved = had?.pages[0]?.count ?? 0;
  if (had && had.name === chName && saved === len) { // finished on an earlier run
    if (PUBLISH && !had.is_published) await publish(had.id);
    skipped++;
    continue;
  }
  if (had && !(had.name === chName && !had.is_published)) fail(`Ya existe un capítulo con el número ${num} (${had.name ?? "sin título"}). Usa otro --desde.`);

  let id = had?.id;
  if (!id) id = must(await supabase.from("chapters").insert({ title_id: title.id, number: num, name: chName }).select("id").single()).id;
  const folder = `${uid}/${title.id}/${id}`;
  if (saved) {
    // An image may have been sent without its row: drop files past the last saved page so they can be sent again.
    const extra = (must(await supabase.storage.from("media").list(folder, { limit: 1000 })) ?? []).filter((f) => parseInt(f.name) > saved).map((f) => `${folder}/${f.name}`);
    if (extra.length) must(await supabase.storage.from("media").remove(extra));
    log(`Parte ${k + 1}: continúa desde la página ${saved + 1} de ${len}`);
  }
  // shortcut: one page at a time, so "pages saved" is always 1..n with no gaps; parallel uploads would be faster.
  for (let i = saved; i < len; i++) {
    const { body, width, height } = await render(from + i);
    const image_path = `${folder}/${i + 1}.webp`;
    must(await supabase.storage.from("media").upload(image_path, body, { contentType: "image/webp", upsert: false }));
    must(await supabase.from("pages").insert({ chapter_id: id, position: i + 1, image_path, width, height }).select());
    process.stdout.write(`\r${new Date().toLocaleTimeString()} Parte ${k + 1} de ${parts} · página ${i + 1} de ${len}   `);
  }
  if (PUBLISH) await publish(id);
  process.stdout.write("\n");
  log(`Parte ${k + 1} lista (capítulo ${num}).`);
}
log(`Listo: ${parts - skipped} subida(s)${skipped ? `, ${skipped} ya estaban completas` : ""}.`);
await doc.destroy();
process.exit(0);
