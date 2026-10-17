import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const MAX_PAGES = 300;

// Renders each PDF page to a JPEG at most maxW wide; toWebp converts them later like any image.
export async function pdfToImages(file: File, maxW = 1600): Promise<File[]> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise.catch(() => { throw new Error(`${file.name}: no es un PDF válido`); });
    if (doc.numPages > MAX_PAGES) throw new Error(`${file.name}: demasiadas páginas (máximo ${MAX_PAGES})`);
    const base = file.name.replace(/\.pdf$/i, "");
    const out: File[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: maxW / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!blob) throw new Error(`${file.name}: no se pudo leer la página ${n}`);
      out.push(new File([blob], `${base}-${String(n).padStart(3, "0")}.jpg`, { type: "image/jpeg" }));
    }
    return out;
  } finally {
    await task.destroy();
  }
}
