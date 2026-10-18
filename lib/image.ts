// Resize to max width and convert to WebP in the browser, so the 4.5 MB serverless body limit never matters.
// shortcut: a canvas taller than ~16k px fails in some browsers; split very tall webtoon strips before uploading.
export async function toWebp(file: File, maxW = 1600, quality = 0.8) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: solo se aceptan JPG, PNG o WebP`);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxW / bmp.width);
  const width = Math.round(bmp.width * k);
  const height = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  canvas.width = canvas.height = 0; // release the backing store now; hundreds of canvases waiting for GC render white
  if (!blob) throw new Error(`${file.name}: no se pudo convertir`);
  return { blob, width, height };
}

export const byName = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true });
