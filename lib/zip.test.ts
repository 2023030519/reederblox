// Run: node --test lib/zip.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { expandFiles } from "./zip.ts";

const png = new Uint8Array([137, 80, 78, 71]);
const zipFile = (entries: Record<string, Uint8Array>, name = "cap-3.zip") =>
  new File([zipSync(entries).slice().buffer], name, { type: "application/zip" });

test("extracts only jpg/png/webp, ignoring folders, macOS junk, hidden files and other types", async () => {
  const out = await expandFiles([zipFile({
    "cap3/01.png": png, "cap3/02.JPG": png, "cap3/03.webp": png,
    "__MACOSX/cap3/._01.png": png, "cap3/.hidden.png": png, "cap3/Thumbs.db": png, "cap3/notas.txt": png,
  })]);
  assert.deepEqual(out.map((f) => f.name).sort(), ["01.png", "02.JPG", "03.webp"]);
  assert.equal(out.find((f) => f.name === "02.JPG")!.type, "image/jpeg");
  assert.equal(out.find((f) => f.name === "01.png")!.type, "image/png");
  assert.equal(out[0].size, png.length);
});

test("passes plain images through and mixes them with zips", async () => {
  const plain = new File([png], "a.png", { type: "image/png" });
  const out = await expandFiles([plain, zipFile({ "b.png": png })]);
  assert.deepEqual(out.map((f) => f.name), ["a.png", "b.png"]);
});

test("a corrupt zip is rejected with a readable message", async () => {
  const bad = new File([new Uint8Array([80, 75, 1, 2, 3])], "malo.zip", { type: "application/zip" });
  await assert.rejects(() => expandFiles([bad]), /no es un ZIP válido/);
});

test("a zip with too many images is rejected", async () => {
  const many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`${i}.png`, png]));
  await assert.rejects(() => expandFiles([zipFile(many)]), /demasiado grande/);
});

test("a zip with no images gives an empty list (the form shows the message)", async () => {
  assert.deepEqual(await expandFiles([zipFile({ "notas.txt": png })]), []);
});
