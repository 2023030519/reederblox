"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, mediaUrl, type Chapter } from "@/lib/supabase";
import { getSaved, savedIds, type SavedChapter } from "@/lib/offline";
import { Button, Callout, Empty, ErrorBox, Skeleton } from "@/components/ui";
import { toast } from "@/lib/feedback";

type Page = { key: string; position: number; src: string; width: number | null; height: number | null };
type Data = {
  chapter: Pick<Chapter, "id" | "title_id" | "number" | "name">;
  title: { name: string; slug: string };
  pages: Page[];
  siblings: { id: string; number: number }[];
  fromCopy: boolean;
  revoke: () => void;
};

async function fromCopy(s: SavedChapter): Promise<Data> {
  const urls = s.pages.map((p) => URL.createObjectURL(p.blob));
  const have = await savedIds();
  return {
    chapter: s.chapter, title: s.title, fromCopy: true,
    pages: s.pages.map((p, i) => ({ key: String(p.position), position: p.position, src: urls[i], width: p.width, height: p.height })),
    siblings: s.siblings.filter((x) => have.has(x.id)), // offline: only chapters that are also saved
    revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

const BAR_MS = 3000; // toolbar stays this long after the last scroll

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMe();
  const router = useRouter();
  const fromStudio = useSearchParams().get("from") === "studio"; // opened from the Studio table
  const q = fromStudio ? "?from=studio" : "";
  const [paged, setPaged] = useState(false);
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pinned = useRef(false); // pointer or focus is on the toolbar: don't hide it
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const asked = useRef<string | null>(null); // chapter whose checkpoint we already looked up
  const checked = useRef<string | null>(null); // ...and got an answer for: only then may we overwrite it

  const d = useFetch<Data | null>(async () => {
    try {
      const chapter = ok(await supabase.from("chapters").select("*, titles(name,slug)").eq("id", id).maybeSingle()) as (Chapter & { titles: { name: string; slug: string } }) | null;
      if (!chapter) return null;
      const pages = ok(await supabase.from("pages").select("*").eq("chapter_id", id).order("position")) as { id: string; position: number; image_path: string; width: number | null; height: number | null }[];
      const siblings = ok(await supabase.from("chapters").select("id,number").eq("title_id", chapter.title_id).order("number")) as { id: string; number: number }[];
      return {
        chapter, title: chapter.titles, siblings, fromCopy: false, revoke: () => {},
        pages: pages.map((p) => ({ key: p.id, position: p.position, src: mediaUrl(p.image_path)!, width: p.width, height: p.height })),
      };
    } catch (e) {
      // No network (or Supabase down): use the downloaded copy if there is one.
      const copy = await getSaved(id).catch(() => undefined);
      if (!copy) throw e;
      return fromCopy(copy);
    }
  }, [id]);

  useEffect(() => () => d.data?.revoke(), [d.data]);

  // Opening a chapter marks it read (needs a connection; silently skipped offline).
  useEffect(() => {
    if (user && d.data && !d.data.fromCopy) supabase.from("chapter_reads").upsert({ user_id: user.id, chapter_id: id }).then(() => {});
  }, [user, d.data, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setI(0);
    root.current?.scrollTo(0, 0);
  }, [id]);

  // Reading is fullscreen by default: the page covers the app, and we also ask the browser for real fullscreen
  // (it may refuse without a recent tap; the cover still works). Leaving the reader leaves fullscreen.
  const ready = !!d.data;
  useEffect(() => {
    if (!ready) return;
    root.current?.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, [ready]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const total = d.data?.pages.length ?? 0;

  // Page under the middle of the screen in strip mode (0-based).
  const stripAt = () => {
    const mid = (root.current?.scrollTop ?? 0) + innerHeight / 2;
    let n = 0;
    root.current?.querySelectorAll<HTMLElement>("[data-page]").forEach((el, k) => { if (el.offsetTop <= mid) n = k; });
    return n;
  };

  // Checkpoint: a second after the reader stops, save the page they are on; null once they reach the last one.
  const checkpoint = (n?: number) => {
    if (!user || !d.data || d.data.fromCopy || checked.current !== id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const page = (n ?? stripAt()) + 1;
      supabase.from("chapter_reads").upsert({ user_id: user.id, chapter_id: id, page: page >= total ? null : page, read_at: new Date().toISOString() }).then(() => {});
    }, 1000);
  };

  // Coming back: jump to the saved page, once per chapter.
  useEffect(() => {
    if (!user || !d.data || d.data.fromCopy || asked.current === id) return;
    asked.current = id;
    supabase.from("chapter_reads").select("page").eq("user_id", user.id).eq("chapter_id", id).maybeSingle().then(({ data }) => {
      checked.current = id;
      const n = data?.page;
      if (!n || n < 2 || n > total) return;
      setI(n - 1);
      root.current?.querySelectorAll("[data-page]")[n - 1]?.scrollIntoView();
      toast(`Sigues en la página ${n}`, "info");
    });
  }, [user, d.data, id, total]);

  useEffect(() => { if (paged) checkpoint(i); }, [i, paged]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!paged) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((n) => Math.min(total - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [paged, total]);

  if (d.loading && d.data === undefined) return <div className="mx-auto max-w-[800px] space-y-2"><Skeleton className="h-16" /><Skeleton className="h-[75vh]" /></div>;
  if (d.error) return <div className="mx-auto max-w-[800px] space-y-3"><ErrorBox message="No se pudo cargar el capítulo. Si no tienes conexión, solo se pueden leer los capítulos descargados." /><Link href="/offline" className="text-accent">Ver mis descargas</Link></div>;
  if (!d.data) return <Empty>Capítulo no encontrado.</Empty>;
  const { chapter, title, pages, siblings } = d.data;
  const at = siblings.findIndex((s) => s.id === id);
  const prev = siblings[at - 1], next = siblings[at + 1];
  const back = fromStudio ? `/studio/${chapter.title_id}` : `/title/${title.slug}`;

  // Show the toolbar, then hide it BAR_MS after the last scroll.
  const reveal = () => {
    setShowBar(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!pinned.current) setShowBar(false); }, BAR_MS);
  };
  const pin = (on: boolean) => { pinned.current = on; if (on) { clearTimeout(timer.current); setShowBar(true); } else reveal(); };

  const step = "flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-2xl leading-none transition active:scale-95";

  return (
    <div ref={root} data-scroller onScroll={() => { reveal(); if (!paged) checkpoint(); }} onClick={() => { if (!paged) reveal(); }}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg">
      {d.data.fromCopy && <div className="mx-auto max-w-[800px] p-3"><Callout tone="info" title="Leyendo la copia descargada">Esta versión está guardada en tu dispositivo. Si el autor la actualizó, vuelve a descargarla con conexión.</Callout></div>}
      {pages.length === 0 && <div className="p-6"><Empty>Este capítulo todavía no tiene páginas.</Empty></div>}
      {paged && pages.length > 0 ? (
        <div className="mx-auto w-full max-w-[800px]">
          {/* Tap the left third to go back, the rest to go on. */}
          <div onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setI((n) => (e.clientX - r.left < r.width / 3 ? Math.max(0, n - 1) : Math.min(total - 1, n + 1)));
            reveal();
          }}><Img p={pages[i]} /></div>
          <p className="py-3 text-center text-sm text-muted" aria-live="polite">{i + 1} / {total}</p>
          {pages[i + 1] && <link rel="preload" as="image" href={pages[i + 1].src} />}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[800px] flex-col pb-28">{pages.map((p) => <Img key={p.key} p={p} />)}</div>
      )}

      <div className={`fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition duration-300 ${showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}>
        <div role="toolbar" aria-label="Herramientas del lector" onPointerEnter={() => pin(true)} onPointerLeave={() => pin(false)} onFocus={() => pin(true)} onBlur={() => pin(false)}
          className="w-full max-w-md space-y-2 rounded-3xl border border-line bg-bg/90 p-2.5 shadow-pop backdrop-blur">
          <div className="flex items-center gap-2">
            <Link href={back} aria-label={fromStudio ? "Volver al Estudio" : "Volver a la obra"} className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-surface active:scale-95">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"><path d="M4 11.5 12 5l8 6.5M6 10v9h4v-5h4v5h4v-9" /></svg>
            </Link>
            <Link href={back} className="min-w-0 flex-1 truncate text-sm font-semibold">{title.name}</Link>
                        <button type="button" onClick={() => { if (!paged) setI(stripAt()); setPaged(!paged); }} className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-muted transition hover:bg-surface">{paged ? "Modo tira" : "Modo páginas"}</button>
          </div>
          <div className="flex items-center gap-2">
            {prev ? <Link href={`/read/${prev.id}${q}`} aria-label="Capítulo anterior" className={`${step} hover:bg-surface`}>‹</Link> : <span aria-hidden className={`${step} opacity-30`}>‹</span>}
            <select aria-label="Capítulo" value={id} onChange={(e) => router.push(`/read/${e.target.value}${q}`)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-field bg-bg px-3 text-sm font-semibold">
              {[...siblings].reverse().map((s) => <option key={s.id} value={s.id}>Capítulo {s.number}{s.id === chapter.id && chapter.name ? ` · ${chapter.name}` : ""}</option>)}
            </select>
            {next ? <Link href={`/read/${next.id}${q}`} aria-label="Capítulo siguiente" className={`${step} hover:bg-surface`}>›</Link> : <span aria-hidden className={`${step} opacity-30`}>›</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reserve the image's aspect ratio and fade it in, so the strip doesn't jump while loading.
function Img({ p }: { p: Page }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [n, setN] = useState(0);
  if (failed) return <div className="p-6 text-center"><p className="text-danger">No se pudo cargar la página {p.position}.</p><Button variant="secondary" onClick={() => { setFailed(false); setN(n + 1); }}>Reintentar</Button></div>;
  return (
    <div data-page className={loaded ? "" : "skeleton"} style={p.width && p.height ? { aspectRatio: `${p.width} / ${p.height}` } : { minHeight: "60vh" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={n} src={p.src} alt={`Página ${p.position}`} width={p.width ?? undefined} height={p.height ?? undefined}
        loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
        className={`block h-auto w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
