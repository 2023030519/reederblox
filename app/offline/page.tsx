"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFetch, useMe } from "@/lib/hooks";
import { supabase, mediaUrl, STATUSES } from "@/lib/supabase";
import { STATUS_TONE } from "@/lib/tags";
import { formatBytes, listSaved, removeSaved, supportsOffline, type SavedChapter } from "@/lib/offline";
import { confirmAsync, toast } from "@/lib/feedback";
import { Callout, CoverCard, Empty, ErrorBox, PageTitle, ProgressBar, Skeleton } from "@/components/ui";

type Group = { slug: string; name: string; cover: string | null; type?: string; status?: string; chapters: (SavedChapter & { date: string })[]; bytes: number };

const shortDate = (iso: string | number) => new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "2-digit" });

async function load(): Promise<Group[]> {
  if (!supportsOffline()) return [];
  const saved = await listSaved();
  // Covers and publish dates need a connection; without one the cards fall back to an initial and the download date.
  const info = new Map<string, { cover_path: string | null; type: string; status: string }>(), dates = new Map<string, string>();
  try {
    const slugs = [...new Set(saved.map((c) => c.title.slug))];
    const t = await supabase.from("titles").select("slug,cover_path,type,status").in("slug", slugs);
    t.data?.forEach((r) => info.set(r.slug, r));
    const c = await supabase.from("chapters").select("id,published_at").in("id", saved.map((x) => x.id));
    c.data?.forEach((r) => r.published_at && dates.set(r.id, r.published_at));
  } catch {}
  const groups = new Map<string, Group>();
  for (const c of saved) {
    const g = groups.get(c.title.slug) ?? { slug: c.title.slug, name: c.title.name, cover: mediaUrl(info.get(c.title.slug)?.cover_path), type: info.get(c.title.slug)?.type, status: info.get(c.title.slug)?.status, chapters: [], bytes: 0 };
    g.chapters.push({ ...c, date: shortDate(dates.get(c.id) ?? c.savedAt) });
    g.bytes += c.bytes;
    groups.set(c.title.slug, g);
  }
  const out = [...groups.values()];
  out.forEach((g) => g.chapters.sort((a, b) => b.chapter.number - a.chapter.number));
  return out.sort((a, b) => Math.max(...b.chapters.map((c) => c.savedAt)) - Math.max(...a.chapters.map((c) => c.savedAt)));
}

const trash = <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const book = (on: boolean) => <svg aria-hidden viewBox="0 0 24 24" className={`size-5 stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75] ${on ? "fill-accent/25" : "fill-none"}`}><path d="M12 6.5C10.3 5.2 8 4.7 4 4.7v13c4 0 6.3.5 8 1.8 1.7-1.3 4-1.8 8-1.8v-13c-4 0-6.3.5-8 1.8zM12 6.5v13" /></svg>;

export default function Downloads() {
  const { user } = useMe();
  const d = useFetch(load, []);
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.quota && setQuota({ used: e.usage ?? 0, total: e.quota }));
  }, [d.data]);

  // Which of the downloaded chapters I've read (needs a connection; skipped offline).
  useEffect(() => {
    if (!user || !d.data?.length) return;
    const ids = d.data.flatMap((g) => g.chapters.map((c) => c.id));
    supabase.from("chapter_reads").select("chapter_id").in("chapter_id", ids).then((r) => r.data && setRead(new Set(r.data.map((x) => x.chapter_id))), () => {});
  }, [user, d.data]);

  if (d.loading && !d.data) return <Skeleton className="h-40" />;
  if (d.error) return <ErrorBox message={d.error} />;
  const groups = d.data ?? [];
  const open = groups.find((g) => g.slug === openSlug);
  const count = groups.reduce((n, g) => n + g.chapters.length, 0);
  const bytes = groups.reduce((n, g) => n + g.bytes, 0);

  const toggleRead = async (cid: string, on: boolean) => {
    if (!user) return;
    const q = on
      ? supabase.from("chapter_reads").upsert({ user_id: user.id, chapter_id: cid })
      : supabase.from("chapter_reads").delete().eq("user_id", user.id).eq("chapter_id", cid);
    const { error } = await q;
    if (error) return toast("No se pudo actualizar", "danger");
    setRead((s) => { const n = new Set(s); if (on) n.add(cid); else n.delete(cid); return n; });
  };

  const remove = async (c: SavedChapter) => {
    if (!(await confirmAsync(`¿Quitar el capítulo ${c.chapter.number} de ${c.title.name}?`, "Quitar"))) return;
    await removeSaved(c.id);
    toast("Descarga eliminada", "info");
    d.reload();
  };

  if (open) {
    return (
      <div className="anim-page space-y-4">
        <button type="button" onClick={() => setOpenSlug(null)} className="flex min-h-10 items-center gap-1 text-sm font-semibold text-muted transition hover:text-fg">‹ Descargas</button>
        <PageTitle sub={`${open.chapters.length} ${open.chapters.length === 1 ? "capítulo descargado" : "capítulos descargados"} · ${formatBytes(open.bytes)}`}>{open.name}</PageTitle>
        <ul className="divide-y divide-line">
          {open.chapters.map((c) => {
            const isRead = read.has(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-surface">
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{c.chapter.number}</span>
                <Link href={`/read/${c.id}`} className={`min-w-0 flex-1 truncate py-2.5 ${isRead ? "text-muted" : "font-semibold"}`}>{c.chapter.name || `Capítulo ${c.chapter.number}`}</Link>
                <time className="shrink-0 font-mono text-xs text-muted">{c.date}</time>
                {user && (
                  <button type="button" aria-pressed={isRead} aria-label={`Capítulo ${c.chapter.number}: marcar como ${isRead ? "no leído" : "leído"}`} onClick={() => toggleRead(c.id, !isRead)}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 hover:bg-line ${isRead ? "text-accent" : "text-muted"}`}>{book(isRead)}</button>
                )}
                <button type="button" aria-label={`Quitar la descarga del capítulo ${c.chapter.number}`} onClick={() => remove(c)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-danger transition active:scale-95 hover:bg-danger-soft">{trash}</button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="anim-page space-y-6">
      <PageTitle sub={count ? `${count} ${count === 1 ? "capítulo" : "capítulos"} · ${formatBytes(bytes)}` : undefined}>Descargas</PageTitle>
      {!supportsOffline() && <Callout tone="warning" title="Tu navegador no permite guardar capítulos">Prueba con otro navegador para usar la lectura sin conexión.</Callout>}
      {quota && (
        <div className="space-y-1">
          <ProgressBar value={(quota.used / quota.total) * 100} label="Espacio usado por el sitio en este dispositivo" />
          <p className="text-xs text-muted">Espacio usado en este dispositivo: {formatBytes(quota.used)} de {formatBytes(quota.total)}</p>
        </div>
      )}
      {groups.length === 0
        ? <Empty>No tienes capítulos descargados. Descárgalos desde la lista de capítulos de una obra para leerlos sin conexión.</Empty>
        : <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {groups.map((g) => (
              <CoverCard key={g.slug} name={g.name} cover={g.cover} type={g.type} onClick={() => setOpenSlug(g.slug)}
                dot={g.status ? STATUS_TONE[g.status] ?? "neutral" : undefined}
                sub={`${g.status ? `${STATUSES[g.status as keyof typeof STATUSES]} · ` : ""}${g.chapters.length} ${g.chapters.length === 1 ? "cap" : "caps"}`} />
            ))}
          </div>}
    </div>
  );
}
