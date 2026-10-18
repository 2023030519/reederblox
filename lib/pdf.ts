import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

// Opens a PDF and renders one page at a time, so a 3000-page book never sits in memory as images.
// shortcut: the PDF file itself is loaded whole; a file over ~1 GB may not open in the browser, split it first.
export async function openPdf(file: File) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise.catch(async () => { await task.destroy(); throw new Error(`${file.name}: no es un PDF válido`); });
  // One canvas reused for every page: a fresh ~14 MB canvas per page outruns the GC on long uploads,
  // and when the browser runs out of canvas memory it renders silently white instead of failing.
  const canvas = document.createElement("canvas");
  return {
    pages: doc.numPages,
    // Page n (1-based) as WebP at most maxW wide, same output as toWebp. Not safe to call concurrently.
    async page(n: number, maxW = 1600, quality = 0.8) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: maxW / page.getViewport({ scale: 1 }).width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
      if (!blob) throw new Error(`${file.name}: no se pudo leer la página ${n}`);
      return { blob, width: canvas.width, height: canvas.height };
    },
    close: () => { canvas.width = canvas.height = 0; return task.destroy(); },
  };
}
