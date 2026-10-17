// Runs WebToEpub (the Chrome extension) over a list of novel URLs and collects the EPUBs.
//
//   node tools/webtoepub/run.mjs [urls.txt] [--out <folder>] [--headless] [--limit <n>]
//
// urls.txt: one novel page per line (the page that lists the chapters). Blank lines and lines starting with # are ignored.
// Re-running skips novels already finished (see out/results.json), so it is safe to stop and resume.
import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const urlsFile = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--out", "--limit"].includes(args[i - 1])) ?? path.join(here, "urls.txt"));
const OUT = path.resolve(opt("--out", path.join(here, "out")));
const LIMIT = Number(opt("--limit", 0)) || Infinity;
const EXT = path.join(here, "extension");
const PROFILE = path.join(here, "profile");
const RESULTS = path.join(OUT, "results.json");

const CHAPTER_WAIT_MS = 120_000; // time for the extension to list the chapters
const EPUB_WAIT_MS = 60 * 60_000; // one novel may take a long time (hundreds of chapters)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(new Date().toLocaleTimeString(), ...m);

// ---- one-time setup: copy the extension out of Chrome and pin its id --------------------------------------------
function setupExtension() {
  if (fs.existsSync(path.join(EXT, "manifest.json"))) return;
  const root = path.join(os.homedir(), "AppData/Local/Google/Chrome/User Data");
  const id = "akiljllkbielkidmammnifcnibaigelm";
  const src = fs.readdirSync(root).map((p) => path.join(root, p, "Extensions", id)).find((p) => fs.existsSync(p));
  if (!src) throw new Error("No encontré WebToEpub en tus perfiles de Chrome. Copia su carpeta a tools/webtoepub/extension.");
  const version = fs.readdirSync(src).sort().at(-1);
  fs.cpSync(path.join(src, version), EXT, { recursive: true });
  fs.rmSync(path.join(EXT, "_metadata"), { recursive: true, force: true }); // Chrome's store signature: invalid once copied
  log("Extensión copiada de", path.join(src, version));
}

// A fixed "key" in the manifest gives the unpacked extension a stable id we can compute.
function pinnedExtensionId() {
  const manifestPath = path.join(EXT, "manifest.json");
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^﻿/, ""));
  if (!m.key) {
    const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    m.key = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
  }
  const hash = crypto.createHash("sha256").update(Buffer.from(m.key, "base64")).digest("hex").slice(0, 32);
  return [...hash].map((c) => String.fromCharCode("a".charCodeAt(0) + parseInt(c, 16))).join("");
}

// Make Chrome save downloads straight into OUT, without asking.
function writePreferences() {
  const dir = path.join(PROFILE, "Default");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Preferences"), JSON.stringify({
    download: { default_directory: OUT, prompt_for_download: false, directory_upgrade: true },
    savefile: { default_directory: OUT },
  }));
}

// ---- helpers ----------------------------------------------------------------------------------------------------
const readList = () => fs.readFileSync(urlsFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const epubs = () => new Set(fs.readdirSync(OUT).filter((f) => f.toLowerCase().endsWith(".epub")));
const loadResults = () => (fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : {});
const saveResults = (r) => fs.writeFileSync(RESULTS, JSON.stringify(r, null, 2));

async function waitForNewEpub(before, ms) {
  const end = Date.now() + ms;
  let candidate = null, lastSize = -1, stableSince = 0;
  while (Date.now() < end) {
    const fresh = [...epubs()].filter((f) => !before.has(f));
    if (fresh.length) {
      const f = fresh[0], size = fs.statSync(path.join(OUT, f)).size;
      if (f === candidate && size === lastSize) { if (Date.now() - stableSince > 4000) return f; }
      else { candidate = f; lastSize = size; stableSince = Date.now(); }
    }
    await sleep(1000);
  }
  return null;
}

async function convert(ctx, helper, extId, url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(1500);
    // An extension page can call chrome.tabs; that is how we learn the tab id the popup needs.
    const tabId = await helper.evaluate(async (href) => {
      const tabs = await chrome.tabs.query({});
      return (tabs.find((t) => t.url === href) ?? tabs.find((t) => t.url?.startsWith(href.split("#")[0])))?.id;
    }, page.url());
    if (!tabId) throw new Error("no encontré el id de la pestaña");

    const popup = await ctx.newPage();
    try {
      await popup.goto(`chrome-extension://${extId}/popup.html?id=${tabId}`, { waitUntil: "domcontentloaded" });
      // Chapters listed?
      const found = await popup.waitForFunction(() => document.querySelectorAll("#chapterUrlsTable tbody tr").length > 0, null, { timeout: CHAPTER_WAIT_MS }).then(() => true, () => false);
      if (!found) throw new Error("la extensión no encontró capítulos (¿sitio sin parser? ¿Cloudflare?)");
      const chapters = await popup.locator("#chapterUrlsTable tbody tr").count();

      // Settings that keep it unattended: no download dialog, skip chapters that fail, overwrite duplicates.
      await popup.evaluate(() => {
        for (const id of ["noDownloadPopupCheckbox", "skipChaptersThatFailFetchCheckbox", "overwriteEpubWhenDuplicateFilenameCheckbox"]) {
          const el = document.getElementById(id);
          if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      });

      const before = epubs();
      log(`  ${chapters} capítulos; empaquetando…`);
      const pack = popup.locator("#packEpubButton");
      await pack.waitFor({ state: "visible", timeout: 60_000 }).catch(() => { throw new Error("no aparece el botón «Pack EPUB»: WebToEpub no tiene parser para este sitio (hay que configurarlo a mano una vez)"); });
      await pack.click({ timeout: 30_000 }).catch(() => { throw new Error("no se pudo pulsar «Pack EPUB» (botón deshabilitado o tapado: el sitio puede pedir configurar el parser)"); });
      const started = Date.now();
      const ticker = setInterval(async () => {
        const msg = await popup.locator("#fetchProgress").textContent().catch(() => "");
        log(`  …${Math.round((Date.now() - started) / 1000)} s ${msg ?? ""}`.trim());
      }, 60_000);
      const file = await waitForNewEpub(before, EPUB_WAIT_MS).finally(() => clearInterval(ticker));
      if (!file) throw new Error("no apareció el EPUB a tiempo");
      return { file, chapters };
    } finally {
      await popup.close().catch(() => {});
    }
  } finally {
    await page.close().catch(() => {});
  }
}

// ---- main -------------------------------------------------------------------------------------------------------
setupExtension();
const extId = pinnedExtensionId();
fs.mkdirSync(OUT, { recursive: true });
writePreferences();

const urls = readList();
if (!urls.length) { console.error(`${urlsFile} no tiene URLs.`); process.exit(1); }
const results = loadResults();

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, // extensions need a real window; --headless uses Chrome's "new" headless, which also supports them
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...(flag("--headless") ? ["--headless=new"] : [])],
});
const helper = await ctx.newPage();
await helper.goto(`chrome-extension://${extId}/manifest.json`, { waitUntil: "domcontentloaded" }); // any extension-origin page: gives us chrome.tabs; popup.html would close itself
log(`Extensión cargada (${extId}). ${urls.length} URLs, salida: ${OUT}`);

let done = 0;
for (const url of urls) {
  if (done >= LIMIT) break;
  if (results[url]?.status === "ok") { log("ya hecho:", url); continue; }
  done++;
  log(`[${done}] ${url}`);
  try {
    const r = await convert(ctx, helper, extId, url);
    results[url] = { status: "ok", ...r, at: new Date().toISOString() };
    log(`  OK → ${r.file}`);
  } catch (e) {
    const why = String(e.message).split("\n")[0]; // first line only: Playwright appends a long call log
    results[url] = { status: "error", error: why, at: new Date().toISOString() };
    log(`  ERROR: ${why}`);
  }
  saveResults(results);
  await sleep(3000 + Math.random() * 4000); // be gentle with the sites
}

await ctx.close();
const all = Object.values(results);
log(`Listo. ${all.filter((r) => r.status === "ok").length} bien, ${all.filter((r) => r.status === "error").length} con error. Detalle: ${RESULTS}`);
