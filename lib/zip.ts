import { unzip } from "fflate";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_FILES = 300;
const MAX_BYTES = 300e6; // uncompressed, guards against zip bombs

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export const isZip = (f: File) => ext(f.name) === "zip" || f.type === "application/zip" || f.type === "application/x-zip-compressed";
export const isPdf = (f: File) => ext(f.name) === "pdf" || f.type === "application/pdf";

// Turns a mixed selection (images and/or zips) into a flat list of image files. PDFs go through lib/pdf instead.
// Skips folders, macOS junk (__MACOSX, ._x), hidden files and anything that is not jpg/png/webp.
// shortcut: one chapter per zip; images in different folders are merged and sorted by file name.
export async function expandFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (!isZip(f)) { out.push(f); continue; }
    const data = new Uint8Array(await f.arrayBuffer());
    let total = 0, count = 0;
    const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
      unzip(data, {
        filter: (e) => {
          const base = e.name.split("/").pop() ?? "";
          if (e.name.includes("__MACOSX/") || base.startsWith(".") || !(ext(base) in MIME)) return false;
          total += e.originalSize;
          count++;
          return count <= MAX_FILES && total <= MAX_BYTES;
        },
      }, (err, res) => (err ? reject(new Error(`${f.name}: no es un ZIP válido`)) : resolve(res))),
    );
    if (count > MAX_FILES || total > MAX_BYTES) {
      throw new Error(`${f.name}: demasiado grande (máximo ${MAX_FILES} imágenes y ${MAX_BYTES / 1e6} MB descomprimido)`);
    }
    for (const [path, bytes] of Object.entries(entries)) {
      const base = path.split("/").pop()!;
      out.push(new File([bytes.slice().buffer], base, { type: MIME[ext(base)] }));
    }
  }
  return out;
}
