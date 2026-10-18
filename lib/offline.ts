// Chapters saved for offline reading: page images live as blobs in IndexedDB.
import { supabase, mediaUrl } from "./supabase";

const DB = "readerblox-offline";
const STORE = "chapters";

export type SavedChapter = {
  id: string;
  title: { name: string; slug: string };
  chapter: { id: string; title_id: string; number: number; name: string | null };
  siblings: { id: string; number: number }[];
  pages: { position: number; blob: Blob; width: number | null; height: number | null }[];
  savedAt: number;
  bytes: number;
};

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento sin conexión"));
});

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const supportsOffline = () => typeof indexedDB !== "undefined";
export const getSaved = (id: string) => tx<SavedChapter | undefined>("readonly", (s) => s.get(id));
export const listSaved = () => tx<SavedChapter[]>("readonly", (s) => s.getAll());
export const removeSaved = (id: string) => tx("readwrite", (s) => s.delete(id));
export const savedIds = async () => new Set((await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) as string[]);

// Downloads every page of a chapter. All-or-nothing: nothing is stored if one page fails.
export async function saveChapter(chapterId: string, onProgress?: (done: number, total: number) => void) {
  const c = await supabase.from("chapters").select("id,title_id,number,name,titles(name,slug)").eq("id", chapterId).single();
  if (c.error) throw new Error(c.error.message);
  const p = await supabase.from("pages").select("position,image_path,width,height").eq("chapter_id", chapterId).order("position");
  if (p.error) throw new Error(p.error.message);
  const s = await supabase.from("chapters").select("id,number").eq("title_id", c.data.title_id).eq("is_published", true).order("number");
  if (s.error) throw new Error(s.error.message);
  if (!p.data.length) throw new Error("Este capítulo no tiene páginas.");

  // 5 downloads at a time; results keep page order.
  const pages: SavedChapter["pages"] = new Array(p.data.length);
  let bytes = 0, done = 0, next = 0;
  const worker = async () => {
    while (next < p.data.length) {
      const i = next++;
      const row = p.data[i];
      const res = await fetch(mediaUrl(row.image_path)!);
      if (!res.ok) throw new Error(`No se pudo descargar la página ${row.position}.`);
      const blob = await res.blob();
      bytes += blob.size;
      pages[i] = { position: row.position, blob, width: row.width, height: row.height };
      onProgress?.(++done, p.data.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, p.data.length) }, worker));
  const titles = c.data.titles as unknown as { name: string; slug: string };
  const saved: SavedChapter = {
    id: chapterId,
    title: titles,
    chapter: { id: c.data.id, title_id: c.data.title_id, number: Number(c.data.number), name: c.data.name },
    siblings: s.data.map((x) => ({ id: x.id, number: Number(x.number) })),
    pages, savedAt: Date.now(), bytes,
  };
  try {
    await tx("readwrite", (st) => st.put(saved));
  } catch (e) {
    // Quota errors surface here; say so in plain words.
    throw new Error((e as DOMException)?.name === "QuotaExceededError" ? "No hay espacio suficiente en el dispositivo." : "No se pudo guardar el capítulo.");
  }
  return saved;
}

export const formatBytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

// Copies every saved chapter to real files: <carpeta elegida>/readerblox/<obra>/Capítulo N[ - nombre]/001.webp…
// Files are always rewritten, so a half-done export fixes itself on the next run.
// shortcut: File System Access API, so Chrome/Edge de escritorio only; a ZIP download would cover the rest.
const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim();
export const supportsExport = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export async function exportSaved(onProgress?: (done: number, total: number) => void) {
  const picked = await (window as unknown as { showDirectoryPicker: (o: { mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "readwrite" });
  const root = await picked.getDirectoryHandle("readerblox", { create: true });
  const saved = await listSaved();
  let done = 0;
  for (const c of saved) {
    const obra = await root.getDirectoryHandle(clean(c.title.name), { create: true });
    const dir = await obra.getDirectoryHandle(clean(`Capítulo ${c.chapter.number}${c.chapter.name ? ` - ${c.chapter.name}` : ""}`), { create: true });
    for (const p of c.pages) {
      const w = await (await dir.getFileHandle(`${String(p.position).padStart(3, "0")}.webp`, { create: true })).createWritable();
      await w.write(p.blob);
      await w.close();
    }
    onProgress?.(++done, saved.length);
  }
  return saved.length;
}
