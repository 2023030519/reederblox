"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, mediaUrl, DEMOGRAPHIES, STATUSES, TYPES, type Chapter, type Title } from "@/lib/supabase";
import { byName, toWebp } from "@/lib/image";
import { expandFiles, isPdf, isZip } from "@/lib/zip";
import { Badge, Button, Callout, Empty, ErrorBox, Field, Input, ProgressBar, Select, Skeleton } from "@/components/ui";
import { confirmAsync, toast } from "@/lib/feedback";
import { SortableGrid } from "@/components/sortable-grid";
import { ImageViewer } from "@/components/image-viewer";

const fileIds = new WeakMap<File, number>();
let nextFileId = 1;
const fileKey = (f: File) => { let id = fileIds.get(f); if (!id) fileIds.set(f, (id = nextFileId++)); return String(id); };

const trashIcon = <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;

const upload = async (path: string, blob: Blob) => {
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);
};

export default function StudioTitle() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useMe();
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Partial<Title>>({});
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [extraGenres, setExtraGenres] = useState<{ id: string; name: string }[]>([]); // created here, not in the fetched list yet
  const [newGenre, setNewGenre] = useState("");
  const [addingGenre, setAddingGenre] = useState(false);
  const [coverView, setCoverView] = useState<number | null>(null);
  const [openCh, setOpenCh] = useState<string | null>(null); // chapter whose pages are being managed

  const data = useFetch(async () => {
    const title = ok(await supabase.from("titles").select("*").eq("id", id).maybeSingle()) as Title | null;
    if (!title) return null;
    const chapters = ok(await supabase.from("chapters").select("*").eq("title_id", id).order("number", { ascending: false })) as Chapter[];
    const genres = ok(await supabase.from("genres").select("id,name").order("name")) as { id: string; name: string }[];
    const mine = ok(await supabase.from("title_genres").select("genre_id").eq("title_id", id)) as { genre_id: string }[];
    return { title, chapters, genres, mine: mine.map((g) => g.genre_id) };
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (data.data) { setForm(data.data.title); setGenreIds(data.data.mine); }
  }, [data.data]);

  if (!ready || (data.loading && !data.data)) return <Skeleton className="h-40" />;
  if (!user) return <Empty>Entra para usar el estudio. <Link href="/login" className="text-accent">Entrar</Link></Empty>;
  if (data.error) return <ErrorBox message={data.error} />;
  if (!data.data || data.data.title.owner_id !== user.id) return <Empty>Esa obra no existe o no es tuya.</Empty>;
  const { title, chapters, genres } = data.data;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Guardando…");
    try {
      ok(await supabase.from("titles").update({
        name: form.name, synopsis: form.synopsis, type: form.type, demography: form.demography || null,
        status: form.status, year: form.year || null, is_published: form.is_published,
      }).eq("id", id).select());
      // Only touch what changed, so a failed insert never wipes the genres the title already had.
      const before = data.data!.mine;
      const added = genreIds.filter((g) => !before.includes(g));
      const removed = before.filter((g) => !genreIds.includes(g));
      if (added.length) ok(await supabase.from("title_genres").insert(added.map((genre_id) => ({ title_id: id, genre_id }))).select());
      if (removed.length) ok(await supabase.from("title_genres").delete().eq("title_id", id).in("genre_id", removed).select());
      setMsg("Guardado"); toast("Cambios guardados");
      data.reload();
    } catch (err) { setMsg((err as Error).message); toast((err as Error).message, "danger"); }
  };

  const addGenre = async () => {
    const name = newGenre.trim();
    if (!name) return;
    const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return toast("Escribe un nombre válido", "danger");
    setAddingGenre(true);
    const { data: g, error } = await supabase.from("genres").insert({ name, slug }).select("id,name").single();
    setAddingGenre(false);
    if (error) return toast(error.code === "23505" ? "Ese género ya existe" : error.message, "danger");
    setExtraGenres((x) => [...x, g]);
    setGenreIds((ids) => [...ids, g.id]);
    setNewGenre("");
    toast("Género creado");
  };

  const setCover = async (file?: File) => {
    if (!file || !user) return;
    setMsg("Subiendo portada…");
    try {
      const { blob } = await toWebp(file, 800);
      const path = `${user.id}/${id}/cover-${Date.now()}.webp`;
      await upload(path, blob);
      ok(await supabase.from("titles").update({ cover_path: path }).eq("id", id).select());
      setMsg("Portada actualizada"); toast("Portada actualizada");
      data.reload();
    } catch (err) { setMsg((err as Error).message); toast((err as Error).message, "danger"); }
  };

  return (
    <div className="space-y-10">
      <Link href="/studio" className="-mb-6 inline-flex min-h-10 items-center text-sm font-semibold text-muted transition hover:text-fg">‹ Estudio · Mis obras</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title.name}</h1>
        <Link href={`/title/${title.slug}`} className="text-sm text-accent">Ver página pública</Link>
      </div>
      {!title.is_published && <Callout tone="warning" title="Esta obra todavía es un borrador">Nadie más la ve. Marca «Obra publicada» y guarda cuando esté lista.</Callout>}
      {title.is_published && chapters.every((c) => !c.is_published) && <Callout tone="info" title="Publicada, pero sin capítulos visibles">Los lectores verán la obra vacía hasta que publiques un capítulo.</Callout>}

      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tipo"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Demografía">
          <Select value={form.demography ?? ""} onChange={(e) => setForm({ ...form, demography: e.target.value || null })}>
            <option value="">—</option>{DEMOGRAPHIES.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Title["status"] })}>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Año"><Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} /></Field>
        <div className="flex items-end gap-3 sm:col-span-2">
          {mediaUrl(title.cover_path) && (
            <button type="button" aria-label="Ver portada actual" onClick={() => setCoverView(0)} className="aspect-[2/3] w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(title.cover_path)!} alt="Portada actual" className="size-full object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1"><Field label="Portada (JPG, PNG o WebP)"><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0])} /></Field></div>
        </div>
        <ImageViewer items={mediaUrl(title.cover_path) ? [{ src: mediaUrl(title.cover_path)!, alt: "Portada actual" }] : []} index={coverView} onIndex={setCoverView} onClose={() => setCoverView(null)} />
        <div className="sm:col-span-2"><Field label="Sinopsis">
          <textarea rows={4} value={form.synopsis ?? ""} onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
            className="w-full rounded-md border border-field bg-bg p-3 text-base" />
        </Field></div>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm text-muted">Géneros</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {[...genres, ...extraGenres].sort((a, b) => a.name.localeCompare(b.name, "es")).map((g) => (
              <label key={g.id} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-sm">
                <input type="checkbox" checked={genreIds.includes(g.id)}
                  onChange={(e) => setGenreIds(e.target.checked ? [...genreIds, g.id] : genreIds.filter((x) => x !== g.id))} />
                {g.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input value={newGenre} maxLength={40} placeholder="Nuevo género" aria-label="Nombre del nuevo género"
              onChange={(e) => setNewGenre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGenre(); } }} />
            <Button type="button" variant="secondary" loading={addingGenre} disabled={!newGenre.trim()} onClick={addGenre} className="shrink-0">Agregar género</Button>
          </div>
        </fieldset>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={!!form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          Obra publicada (visible para todos)
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit">Guardar</Button>
          <span role="status" className="text-sm text-muted">{msg}</span>
        </div>
      </form>

      <NewChapter titleId={id} uid={user.id} onDone={data.reload} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Capítulos</h2>
        {chapters.length === 0 && <Empty>Aún no hay capítulos. Sube el primero arriba.</Empty>}
        {/* # | name | date | pages | show/hide | delete  (same table as the public title page) */}
        <ul className="divide-y divide-line">
          {chapters.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-surface">
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{c.number}</span>
                <Link href={`/read/${c.id}?from=studio`} className={`min-w-0 flex-1 truncate py-2.5 ${c.is_published ? "font-semibold" : "text-muted"}`}>
                  {c.name || `Capítulo ${c.number}`} {!c.is_published && <Badge tone="warning">Borrador</Badge>}
                </Link>
                {c.published_at && <time className="shrink-0 font-mono text-xs text-muted" dateTime={c.published_at}>{new Date(c.published_at).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "2-digit" })}</time>}
                <button type="button" aria-label={`Páginas del capítulo ${c.number}`} aria-expanded={openCh === c.id} onClick={() => setOpenCh(openCh === c.id ? null : c.id)}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 hover:bg-line ${openCh === c.id ? "text-accent" : "text-muted"}`}>
                  <svg aria-hidden viewBox="0 0 24 24" className={`size-5 stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75] ${openCh === c.id ? "fill-accent/25" : "fill-none"}`}><path d="M12 6.5C10.3 5.2 8 4.7 4 4.7v13c4 0 6.3.5 8 1.8 1.7-1.3 4-1.8 8-1.8v-13c-4 0-6.3.5-8 1.8zM12 6.5v13" /></svg>
                </button>
                <button type="button" aria-label={c.is_published ? `Ocultar el capítulo ${c.number}` : `Publicar el capítulo ${c.number}`}
                  onClick={async () => { ok(await supabase.from("chapters").update({ is_published: !c.is_published, published_at: c.is_published ? null : new Date().toISOString() }).eq("id", c.id).select()); data.reload(); }}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 hover:bg-line ${c.is_published ? "text-muted" : "text-warning"}`}>
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]">
                    {c.is_published
                      ? <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>
                      : <><path d="M2 12s3.5-6.5 10-6.5c2 0 3.7.6 5.2 1.4M22 12s-3.5 6.5-10 6.5c-2 0-3.7-.6-5.2-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>}
                  </svg>
                </button>
                <button type="button" aria-label={`Borrar el capítulo ${c.number}`}
                  onClick={async () => {
                    if (!(await confirmAsync(`¿Borrar el capítulo ${c.number}? No se puede deshacer.`))) return;
                    await removeChapter(c.id);
                    data.reload();
                  }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-danger transition active:scale-95 hover:bg-danger-soft">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                </button>
              </div>
              {openCh === c.id && <PageManager chapterId={c.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Deletes storage files first, then the row (pages cascade).
async function removeChapter(chapterId: string) {
  const pages = ok(await supabase.from("pages").select("image_path").eq("chapter_id", chapterId)) as { image_path: string }[];
  if (pages.length) await supabase.storage.from("media").remove(pages.map((p) => p.image_path));
  ok(await supabase.from("chapters").delete().eq("id", chapterId).select());
}

function NewChapter({ titleId, uid, onDone }: { titleId: string; uid: string; onDone: () => void }) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  const [publish, setPublish] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [pct, setPct] = useState(0);
  const [drag, setDrag] = useState(false);
  const [inputKey, setInputKey] = useState(0); // remounts the file input to clear it
  const [pdf, setPdf] = useState<{ file: File; pages: number }[] | null>(null);
  const [perPart, setPerPart] = useState("100");

  // Object URLs for the thumbnails; revoked when the list changes.
  useEffect(() => {
    const urls = new Map(files.map((f) => [f, URL.createObjectURL(f)] as const));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Accepts images and/or a ZIP (shown as thumbnails), one PDF (rendered page by page while uploading),
  // or several PDFs: one chapter each, in natural file-name order (2 before 10).
  const pick = async (picked: File[]) => {
    if (!picked.length) return;
    setError("");
    setReading(true);
    try {
      const docs = picked.filter(isPdf).sort(byName);
      if (docs.length) {
        if (docs.length < picked.length) throw new Error("Sube los PDF solos, sin mezclar con imágenes.");
        if (docs.length === 1) {
          const reader = await (await import("@/lib/pdf")).openPdf(docs[0]);
          await reader.close();
          setPdf([{ file: docs[0], pages: reader.pages }]);
        } else {
          setPdf(docs.map((file) => ({ file, pages: 0 }))); // each one is opened when its turn comes
        }
        setFiles([]);
      } else {
        const images = (await expandFiles(picked)).sort(byName);
        if (!images.length) throw new Error("No encontré imágenes JPG, PNG o WebP en lo que elegiste.");
        setFiles(images);
        setPdf(null);
      }
      const pack = docs[0] ?? picked.find(isZip);
      if (!number && pack) {
        const n = pack.name.replace(/\.(zip|pdf)$/i, "").match(/(\d+(?:\.\d+)?)(?!.*\d)/); // last number in the file name
        if (n) setNumber(n[1]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setReading(false);
  };

  // A PDF longer than "páginas por parte" becomes consecutive chapters: Parte 1, Parte 2…
  // Several PDFs skip that split: each file is one whole chapter.
  const multi = (pdf?.length ?? 0) > 1;
  const size = Math.max(1, Math.floor(Number(perPart)) || 1);
  const partCount = pdf ? (multi ? pdf.length : Math.ceil(pdf[0].pages / size)) : 1;
  const totalPages = pdf ? pdf[0].pages : files.length; // unknown with several PDFs; progress then counts chapters

  // Creates one chapter from page renderers, or continues a draft left by an interrupted try (had).
  // Each page's row is saved right after its image, so a stop never loses more than the page in flight.
  const uploadChapter = async (num: number, chName: string | null, pages: (() => Promise<{ blob: Blob; width: number; height: number }>)[], onPage: (i: number) => void, had?: { id: string; done: number }) => {
    let chapterId = had?.id;
    if (!chapterId) {
      const ch = await supabase.from("chapters").insert({ title_id: titleId, number: num, name: chName }).select("id").single();
      if (ch.error) throw new Error(ch.error.code === "23505" ? `Ya existe un capítulo con el número ${num}.` : ch.error.message);
      chapterId = ch.data.id;
    } else {
      // An image may have been sent without its row: drop files past the last saved page so they can be sent again.
      const folder = `${uid}/${titleId}/${chapterId}`;
      const extra = ((await supabase.storage.from("media").list(folder, { limit: 1000 })).data ?? [])
        .filter((f) => parseInt(f.name) > had!.done).map((f) => `${folder}/${f.name}`);
      if (extra.length) await supabase.storage.from("media").remove(extra);
    }
    for (let i = had?.done ?? 0; i < pages.length; i++) {
      onPage(i);
      const { blob, width, height } = await pages[i]();
      const image_path = `${uid}/${titleId}/${chapterId}/${i + 1}.webp`;
      await upload(image_path, blob);
      ok(await supabase.from("pages").insert({ chapter_id: chapterId, position: i + 1, image_path, width, height }).select());
    }
    if (publish) ok(await supabase.from("chapters").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", chapterId).select());
  };

  // Uploading runs in this tab: a locked phone or a lost connection stops it. Picking the same file and number
  // again resumes: finished chapters are skipped and a half-uploaded one is cleaned up and redone.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length && !pdf) return setError("Elige imágenes, un ZIP o un PDF.");
    setBusy(true);
    setError("");
    // Keep the screen on while uploading; the browser drops the lock when the tab is hidden, so take it again on return.
    const wake = () => navigator.wakeLock?.request("screen").catch(() => null);
    let lock = await wake();
    const relock = async () => { if (document.visibilityState === "visible") lock = await wake(); };
    document.addEventListener("visibilitychange", relock);
    const stay = (ev: BeforeUnloadEvent) => ev.preventDefault(); // the browser asks before closing the tab
    addEventListener("beforeunload", stay);
    let k = 0, skipped = 0;
    try {
      type Existing = { id: string; number: number; name: string | null; is_published: boolean; pages: { count: number }[] };
      const existing = new Map((ok(await supabase.from("chapters").select("id,number,name,is_published,pages(count)").eq("title_id", titleId)) as Existing[]).map((c) => [Number(c.number), c]));
      const lib = pdf && (await import("@/lib/pdf"));
      const single = lib && !multi ? await lib.openPdf(pdf![0].file) : null;
      // "Capitulo 13" as título with several PDFs → Capitulo 13, Capitulo 14, …; empty leaves the default «Capítulo N».
      const nameNum = multi ? name.match(/(\d+)\s*$/)?.[1] : null;
      try {
        for (; k < partCount; k++) {
          const reader = multi ? await lib!.openPdf(pdf![k].file) : single;
          try {
            const pages = reader
              ? multi
                ? Array.from({ length: reader.pages }, (_, j) => () => reader.page(j + 1))
                : Array.from({ length: Math.min(size, reader.pages - k * size) }, (_, j) => () => reader.page(k * size + j + 1))
              : files.map((f) => () => toWebp(f));
            const num = Number(number) + k;
            const part = !multi && partCount > 1 ? `Parte ${k + 1}` : "";
            const chName = multi
              ? (name ? (nameNum ? name.replace(/\d+\s*$/, "") + (Number(nameNum) + k) : `${name} ${num}`) : null)
              : [name, part].filter(Boolean).join(" · ") || null;
            const had = existing.get(num);
            const saved = had?.pages[0]?.count ?? 0;
            if (had && had.name === chName && saved === pages.length) { // finished on an earlier try
              if (publish && !had.is_published) ok(await supabase.from("chapters").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", had.id).select());
              skipped++;
              continue;
            }
            // A draft with the same name and fewer pages is an interrupted try: continue it after its last saved page.
            const resume = had && had.name === chName && !had.is_published ? { id: had.id, done: saved } : undefined;
            await uploadChapter(num, chName, pages, (i) => {
              setProgress(multi
                ? `${pdf![k].file.name} (${k + 1} de ${partCount}) · página ${i + 1} de ${pages.length}…`
                : `${part ? `${part} de ${partCount} · ` : ""}Subiendo ${i + 1} de ${pages.length}…`);
              setPct(multi ? ((k + i / pages.length) / partCount) * 100 : ((k * size + i) / totalPages) * 100);
            }, resume);
          } finally {
            if (multi && reader) await reader.close();
          }
        }
      } finally {
        await single?.close();
      }
      setPct(100);
      setNumber(""); setName(""); setFiles([]); setPdf(null); setProgress(""); setInputKey((n) => n + 1);
      onDone();
      toast(skipped ? `${partCount - skipped} subidos; ${skipped} ya estaban completos` : partCount > 1 ? `${partCount} capítulos subidos` : "Capítulo subido");
    } catch (err) {
      const msg = (err as Error).message;
      const again = msg.startsWith("Ya existe") ? "" : `Para continuar, pulsa Subir otra vez (o vuelve a elegir ${multi ? "los mismos archivos" : "el mismo archivo"} con el mismo número): lo que ya se subió se salta.`;
      setError(partCount > 1
        ? `Se completaron ${k} de ${partCount} ${multi ? "capítulos" : "partes"}. Falló ${multi ? `«${pdf![k]?.file.name}»` : `la parte ${k + 1}`}: ${msg} ${again}`
        : `${msg} ${again}`);
      toast("No se pudo subir el capítulo", "danger");
      setProgress("");
      if (k) onDone();
    } finally {
      removeEventListener("beforeunload", stay);
      document.removeEventListener("visibilitychange", relock);
      lock?.release().catch(() => {});
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Subir capítulo</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Número"><Input required type="number" step="0.01" min="0" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="Título (opcional)"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick([...e.dataTransfer.files]); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-within:border-accent ${drag ? "border-accent bg-bg" : "border-field"}`}
      >
        <span className="font-semibold">{reading ? "Leyendo archivos…" : "Arrastra aquí las páginas, un ZIP o PDFs"}</span>
        <span className="text-sm text-muted">o haz clic para elegir · JPG, PNG, WebP, un .zip con las imágenes, un .pdf, o varios .pdf (un capítulo cada uno)</span>
        <input key={inputKey} type="file" multiple accept="image/jpeg,image/png,image/webp,.zip,application/zip,.pdf,application/pdf" className="sr-only"
          aria-label="Páginas del capítulo: imágenes, un ZIP o un PDF"
          onChange={(e) => pick([...(e.target.files ?? [])])} />
      </label>

      {pdf && (
        <div className="space-y-3 rounded-lg border border-line bg-bg p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium">
              {multi ? `${pdf.length} PDFs · un capítulo cada uno` : `${pdf[0].file.name} · ${pdf[0].pages} páginas · ${(pdf[0].file.size / 1e6).toFixed(1)} MB`}
            </span>
            <button type="button" className="shrink-0 text-accent" disabled={busy} onClick={() => { setPdf(null); setInputKey((k) => k + 1); }}>Quitar</button>
          </div>
          {multi ? (
            <>
              <ol className="max-h-48 overflow-y-auto text-sm text-muted">
                {pdf.map((p, i) => (
                  <li key={fileKey(p.file)} className="truncate py-0.5">
                    <span className="font-mono text-fg">{(Number(number) || 1) + i}</span> · {p.file.name}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted">En orden de nombre de archivo (2 antes que 10). Si el orden está mal, renombra los archivos y vuelve a elegirlos. El título «Capitulo 13» se vuelve «Capitulo 14», «Capitulo 15»… en los siguientes.</p>
            </>
          ) : (
            <>
              <Field label="Páginas por parte"><Input required type="number" min="1" step="1" value={perPart} disabled={busy} onChange={(e) => setPerPart(e.target.value)} /></Field>
              <p className="text-sm text-muted">
                {partCount > 1
                  ? `Se crearán ${partCount} capítulos${number ? `, del ${number} al ${Number(number) + partCount - 1}` : ""}, llamados «Parte 1», «Parte 2»…`
                  : "Se creará un solo capítulo."}
              </p>
            </>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{files.length} páginas · {(files.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(1)} MB antes de convertir</span>
            <button type="button" className="text-accent" onClick={() => { setFiles([]); setInputKey((k) => k + 1); }}>Quitar todo</button>
          </div>
          <SortableGrid className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8" items={files} getKey={fileKey} onReorder={setFiles} disabled={busy}
            renderItem={(f, i) => (
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-bg ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previews.get(f) && <img src={previews.get(f)} alt={`Página ${i + 1}: ${f.name}`} draggable={false} onClick={() => setViewIdx(i)} className="h-full w-full cursor-zoom-in object-cover" />}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-xs text-white">{i + 1}</span>
                <button type="button" aria-label={`Quitar página ${i + 1}`} disabled={busy} onClick={() => setFiles(files.filter((x) => x !== f))}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-danger hover:text-bg">{trashIcon}</button>
              </div>
            )} />
          <p className="text-xs text-muted">Toca una página para verla grande. Mantén presionada y arrastra para cambiar su orden.</p>
          <ImageViewer items={files.map((f, i) => ({ src: previews.get(f) ?? "", alt: `Página ${i + 1}: ${f.name}` }))} index={viewIdx} onIndex={setViewIdx} onClose={() => setViewIdx(null)} />
        </div>
      )}

      <label className="flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="size-4 accent-[var(--c-accent)]" /> Publicar al terminar</label>
      {(totalPages > 150 || multi || files.reduce((s, f) => s + f.size, 0) > 60e6) &&
        <Callout tone="warning" title="Subida grande">Puede tardar varios minutos. Mantén esta pestaña abierta y la pantalla encendida. Si se corta, vuelve a elegir el mismo archivo con el mismo número y continúa donde se quedó.</Callout>}
      {busy && <ProgressBar value={pct} label="Progreso de la subida" />}
      {error && <ErrorBox message={error} />}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy || reading}>{partCount > 1 ? `Subir ${partCount} capítulos` : "Subir capítulo"}</Button>
        <span role="status" className="text-sm text-muted">{progress}</span>
      </div>
    </form>
  );
}

type PageRow = { id: string; chapter_id: string; position: number; image_path: string };

// Reorder and delete the pages already uploaded to a chapter.
function PageManager({ chapterId }: { chapterId: string }) {
  const res = useFetch(async () => ok(await supabase.from("pages").select("id,chapter_id,position,image_path").eq("chapter_id", chapterId).order("position")) as PageRow[], [chapterId]);
  const [list, setList] = useState<PageRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  useEffect(() => {
    if (res.data) setList(res.data);
  }, [res.data]);

  const dirty = !!res.data && list.some((p, i) => p.id !== res.data![i]?.id);

  // (chapter_id, position) is unique, so park the rows out of range first, then put them in their final slots.
  const persist = async (rows: PageRow[]) => {
    const at = (pos: (i: number) => number) => rows.map((p, i) => ({ id: p.id, chapter_id: p.chapter_id, image_path: p.image_path, position: pos(i) }));
    ok(await supabase.from("pages").upsert(at((i) => 1_000_000 + i + 1), { onConflict: "id" }).select());
    ok(await supabase.from("pages").upsert(at((i) => i + 1), { onConflict: "id" }).select());
  };

  const run = async (job: () => Promise<void>) => {
    setSaving(true); setError("");
    try { await job(); res.reload(); } catch (e) { setError((e as Error).message); toast((e as Error).message, "danger"); }
    setSaving(false);
  };

  const remove = async (p: PageRow, i: number) => {
    if (!(await confirmAsync(`¿Borrar la página ${i + 1}? No se puede deshacer.`))) return;
    await run(async () => {
      ok(await supabase.from("pages").delete().eq("id", p.id).select());
      await supabase.storage.from("media").remove([p.image_path]).catch(() => {}); // an orphan file is harmless
      const rest = list.filter((x) => x.id !== p.id);
      setList(rest);
      if (rest.length) await persist(rest); // closes the gap; also saves any pending reorder
      toast("Página borrada");
    });
  };

  if (res.loading && !res.data) return <Skeleton className="mt-3 h-32" />;
  if (res.error) return <div className="mt-3"><ErrorBox message={res.error} /></div>;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3">
      {list.length === 0 ? <Empty>Este capítulo no tiene páginas.</Empty> : (
        <>
          <SortableGrid className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6" items={list} getKey={(p) => p.id} onReorder={setList} disabled={saving}
            renderItem={(p, i) => (
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-bg ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(p.image_path)!} alt={`Página ${i + 1}`} loading="lazy" draggable={false} onClick={() => setViewIdx(i)} className="size-full cursor-zoom-in object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-xs text-white">{i + 1}</span>
                <button type="button" aria-label={`Borrar página ${i + 1}`} disabled={saving} onClick={() => remove(p, i)}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-danger hover:text-bg disabled:opacity-40">{trashIcon}</button>
              </div>
            )} />
          <p className="text-xs text-muted">Toca una página para verla grande. Mantén presionada y arrastra para cambiar su orden.</p>
          <ImageViewer items={list.map((p, i) => ({ src: mediaUrl(p.image_path)!, alt: `Página ${i + 1}` }))} index={viewIdx} onIndex={setViewIdx} onClose={() => setViewIdx(null)} />
        </>
      )}
      {error && <ErrorBox message={error} />}
      {dirty && (
        <div className="flex items-center gap-2">
          <Button loading={saving} onClick={() => run(async () => { await persist(list); toast("Orden guardado"); })}>Guardar orden</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setList(res.data ?? [])}>Descartar</Button>
        </div>
      )}
    </div>
  );
}
