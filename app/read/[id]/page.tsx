"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const MAX_ZOOM = 4;
const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMe();
  const router = useRouter();
  const fromStudio = useSearchParams().get("from") === "studio"; // opened from the Studio table
  const q = fromStudio ? "?from=studio" : "";
  const [paged, setPaged] = useState(false);
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(true); // a tap on the page shows or hides it
  const [full, setFull] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const asked = useRef<string | null>(null); // chapter whose checkpoint we already looked up
  const checked = useRef<string | null>(null); // ...and got an answer for: only then may we overwrite it
  // Our own zoom: the browser's pinch zoom is off in real fullscreen (and disabled here with touch-action so they don't stack).
  const [zoom, setZoom] = useState(1);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const focus = useRef<{ x: number; y: number; left: number; top: number; k: number } | null>(null);

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

  // Real fullscreen only from the toolbar button; leaving the reader leaves it.
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch(() => toast("Tu navegador no permitió la pantalla completa", "info"));

  const total = d.data?.pages.length ?? 0;

  // Zoom to z keeping the point (x, y) of the screen in place.
  const zoomTo = (z: number, x = innerWidth / 2, y = innerHeight / 2) => {
    z = Math.min(MAX_ZOOM, Math.max(1, z));
    const el = root.current;
    if (!el || z === zoom) return;
    focus.current = { x, y, left: el.scrollLeft, top: el.scrollTop, k: z / zoom };
    setZoom(z);
  };
  useLayoutEffect(() => {
    const el = root.current, f = focus.current;
    if (!el || !f) return;
    el.scrollLeft = (f.left + f.x) * f.k - f.x;
    el.scrollTop = (f.top + f.y) * f.k - f.y;
    focus.current = null;
  }, [zoom]);

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

  // The "Guardar página" button: save the page right now and say so.
  const markPage = async () => {
    if (!user) return toast("Entra con tu cuenta para guardar tu página", "info");
    clearTimeout(saveTimer.current);
    const page = (paged ? i : stripAt()) + 1;
    const { error } = await supabase.from("chapter_reads").upsert({ user_id: user.id, chapter_id: id, page, read_at: new Date().toISOString() });
    toast(error ? "No se pudo guardar la página" : `Página ${page} guardada`, error ? "danger" : "success");
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

  const zoomed = zoom > 1 ? { width: Math.min(800, innerWidth) * zoom, maxWidth: "none" } : undefined;
  const step = "flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-2xl leading-none transition active:scale-95";

  return (
    <div ref={root} data-scroller onScroll={() => { if (!paged) checkpoint(); }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[role="toolbar"]')) return;
        // Pages mode: the left third of the screen goes back, the right third goes on. Any other tap shows or hides the toolbar.
        const x = e.clientX / innerWidth;
        if (paged && total && x < 1 / 3) return setI((n) => Math.max(0, n - 1));
        if (paged && total && x > 2 / 3) return setI((n) => Math.min(total - 1, n + 1));
        setShowBar((s) => !s);
      }}
      onTouchStart={(e) => { if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom }; }}
      onTouchMove={(e) => {
        if (!pinch.current || e.touches.length !== 2) return;
        const t = e.touches;
        zoomTo(pinch.current.z * dist(t) / pinch.current.d, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      }}
      onTouchEnd={(e) => { if (e.touches.length < 2) pinch.current = null; }}
      className="fixed inset-0 z-50 touch-pan-x touch-pan-y overflow-auto overscroll-contain bg-bg">
      {d.data.fromCopy && <div className="mx-auto max-w-[800px] p-3"><Callout tone="info" title="Leyendo la copia descargada">Esta versión está guardada en tu dispositivo. Si el autor la actualizó, vuelve a descargarla con conexión.</Callout></div>}
      {pages.length === 0 && <div className="p-6"><Empty>Este capítulo todavía no tiene páginas.</Empty></div>}
      {paged && pages.length > 0 ? (
        <div className="mx-auto w-full max-w-[800px]" style={zoomed}>
          <Img p={pages[i]} />
          <p className="py-3 text-center text-sm text-muted" aria-live="polite">{i + 1} / {total}</p>
          {pages[i + 1] && <link rel="preload" as="image" href={pages[i + 1].src} />}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[800px] flex-col pb-28" style={zoomed}>{pages.map((p) => <Img key={p.key} p={p} />)}</div>
      )}

      <div className={`fixed inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition duration-300 ${showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}>
        <div role="toolbar" aria-label="Herramientas del lector" onFocus={() => setShowBar(true)}
          className="w-full max-w-md space-y-2 rounded-3xl border border-line bg-bg/90 p-2.5 shadow-pop backdrop-blur">
          <div className="flex items-center gap-2">
            <Link href={back} aria-label={fromStudio ? "Volver al Estudio" : "Volver a la obra"} className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-surface active:scale-95">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"><path d="M4 11.5 12 5l8 6.5M6 10v9h4v-5h4v5h4v-9" /></svg>
            </Link>
            <Link href={back} className="min-w-0 flex-1 truncate text-sm font-semibold">{title.name}</Link>
                        <button type="button" onClick={() => { if (!paged) setI(stripAt()); setPaged(!paged); }} className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-muted transition hover:bg-surface">{paged ? "Modo tira" : "Modo páginas"}</button>
          </div>
          <div className="flex items-center justify-center gap-1 text-sm font-semibold">
            <button type="button" aria-label="Alejar" disabled={zoom <= 1} onClick={() => zoomTo(zoom / 1.25)} className="flex size-9 items-center justify-center rounded-full text-lg transition hover:bg-surface active:scale-95 disabled:opacity-30">−</button>
            <button type="button" aria-label={`${Math.round(zoom * 100)}%, restablecer zoom`} onClick={() => zoomTo(1)} className="min-w-14 rounded-full px-2 py-1 tabular-nums transition hover:bg-surface">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="Acercar" disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(zoom * 1.25)} className="flex size-9 items-center justify-center rounded-full text-lg transition hover:bg-surface active:scale-95 disabled:opacity-30">+</button>
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            <button type="button" onClick={markPage} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs transition hover:bg-surface active:scale-95">
              <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"><path d="M6 4h12v17l-6-4-6 4z" /></svg>Guardar página
            </button>
            <button type="button" aria-label={full ? "Salir de pantalla completa" : "Pantalla completa"} aria-pressed={full} onClick={toggleFull} className="flex size-9 items-center justify-center rounded-full transition hover:bg-surface active:scale-95">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]">
                <path d={full ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"} />
              </svg>
            </button>
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
