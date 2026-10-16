"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, mediaUrl, LIBRARY, type Chapter, type Title } from "@/lib/supabase";
import { Badge, Callout, DemographyBadge, Empty, GenreChip, ErrorBox, SectionTitle, Select, Skeleton, Spinner, StatusBadge, TypeChip } from "@/components/ui";
import { saveChapter, savedIds, supportsOffline } from "@/lib/offline";
import { toast } from "@/lib/feedback";

type Full = Title & { title_genres: { genres: { name: string } }[]; profiles: { username: string; display_name: string } };

export default function TitlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [have, setHave] = useState<Set<string>>(new Set()); // downloaded chapters
  const [dl, setDl] = useState<Set<string>>(new Set()); // downloading now
  const [oldestFirst, setOldestFirst] = useState(false);

  useEffect(() => {
    if (supportsOffline()) savedIds().then(setHave, () => {});
  }, []);

  useEffect(() => {
    if (!zoom) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [zoom]);

  const d = useFetch(async () => {
    const title = ok(await supabase.from("titles").select("*, title_genres(genres(name)), profiles!owner_id(username,display_name)").eq("slug", slug).maybeSingle()) as Full | null;
    if (!title) return null;
    // chapter_reads is embedded (RLS limits it to my rows) so a long series never builds a huge .in() URL.
    const rows = ok(await supabase.from("chapters").select("*, chapter_reads(chapter_id)").eq("title_id", title.id).order("number", { ascending: false })) as (Chapter & { chapter_reads: { chapter_id: string }[] })[];
    const chapters: Chapter[] = rows;
    let status = "", read = new Set<string>(), myLists: { id: string; name: string }[] = [], inLists = new Set<string>();
    if (user) {
      status = (await supabase.from("library_entries").select("status").eq("user_id", user.id).eq("title_id", title.id).maybeSingle()).data?.status ?? "";
      read = new Set(rows.filter((c) => c.chapter_reads.length).map((c) => c.id));
      myLists = ok(await supabase.from("lists").select("id,name").eq("owner_id", user.id).order("name")) as { id: string; name: string }[];
      if (myLists.length) inLists = new Set(ok(await supabase.from("list_items").select("list_id").eq("title_id", title.id).in("list_id", myLists.map((l) => l.id))).map((r: { list_id: string }) => r.list_id));
    }
    return { title, chapters, status, read, myLists, inLists };
  }, [slug, user?.id]);

  if (d.loading && d.data === undefined) return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Empty>No encontramos esa obra. <Link href="/biblioteca" className="text-accent">Volver a la biblioteca</Link></Empty>;
  const { title, chapters, status, read, myLists, inLists } = d.data;
  const cover = mediaUrl(title.cover_path);

  const setStatus = async (value: string) => {
    if (!user) return;
    setBusy(true);
    if (value) ok(await supabase.from("library_entries").upsert({ user_id: user.id, title_id: title.id, status: value, updated_at: new Date().toISOString() }).select());
    else ok(await supabase.from("library_entries").delete().eq("user_id", user.id).eq("title_id", title.id).select());
    setBusy(false);
    d.reload();
  };

  const mark = async (ids: string[], on: boolean) => {
    if (!user || !ids.length) return;
    if (on) ok(await supabase.from("chapter_reads").upsert(ids.map((chapter_id) => ({ user_id: user.id, chapter_id }))).select());
    else ok(await supabase.from("chapter_reads").delete().eq("user_id", user.id).in("chapter_id", ids).select());
    d.reload();
  };

  const toggleList = async (listId: string, on: boolean) => {
    if (on) ok(await supabase.from("list_items").upsert({ list_id: listId, title_id: title.id }).select());
    else ok(await supabase.from("list_items").delete().eq("list_id", listId).eq("title_id", title.id).select());
    d.reload();
  };

  const download = async (cid: string) => {
    setDl((s) => new Set(s).add(cid));
    try {
      await saveChapter(cid, () => {});
      setHave((s) => new Set(s).add(cid));
      toast("Capítulo guardado para leer sin conexión");
    } catch (e) {
      toast((e as Error).message, "danger");
    }
    setDl((s) => { const n = new Set(s); n.delete(cid); return n; });
  };

  const first = [...chapters].reverse().find((c) => !read.has(c.id)) ?? chapters[0];

  return (
    <div className="anim-page space-y-8">
      {!title.is_published && <Callout tone="warning" title="Esta obra es un borrador">Solo la ves tú. Publícala desde el Estudio para que la vean los demás.</Callout>}
      <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl border border-line p-4 sm:p-6">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-20 blur-2xl" />
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title.name}</h1>
        <button type="button" disabled={!cover} onClick={() => setZoom(true)} aria-label="Ver portada completa"
          className="mx-auto block aspect-[2/3] w-[340px] max-w-full sm:w-[400px] cursor-zoom-in overflow-hidden rounded-xl bg-surface shadow-pop transition active:scale-[.98] disabled:cursor-default">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`Portada de ${title.name}`} className="h-full w-full object-cover" />
          )}
        </button>
        <div className="space-y-3">
          <div className="flex flex-nowrap items-center gap-1 [&>*]:!px-2 [&>*]:!text-[11px]">
            <TypeChip type={title.type} /><StatusBadge status={title.status} />
            {title.demography && <DemographyBadge demography={title.demography} />}
            {title.year && <Badge>{String(title.year)}</Badge>}
            {!title.is_published && <Badge tone="warning">Borrador</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {title.title_genres.map((g) => <GenreChip key={g.genres.name} name={g.genres.name} />)}
          </div>
          <p className="text-sm">Por <Link href={`/u/${title.profiles.username}`} className="text-accent">{title.profiles.display_name}</Link></p>
          <p className={open ? "whitespace-pre-line" : "line-clamp-4 whitespace-pre-line"}>{title.synopsis || "Sin sinopsis."}</p>
          {title.synopsis.length > 200 && <button className="text-sm text-accent" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Ver menos" : "Ver más"}</button>}
          <div className="flex items-center gap-3">
            {first && <Link href={`/read/${first.id}`} className="inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-card transition hover:brightness-110 active:scale-[.97]">{read.size ? "Continuar" : "Empezar a leer"}</Link>}
            {user
              ? <label className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-sm">Estado
                  <Select disabled={busy} value={status} onChange={(e) => setStatus(e.target.value)} className="w-full min-w-0 flex-1">
                    <option value="">---</option>
                    {Object.entries(LIBRARY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select></label>
              : <Link href="/login" className="text-sm text-accent">Entra para guardar esta obra</Link>}
          </div>
        </div>
      </div>

      {zoom && cover && (
        <div role="dialog" aria-modal="true" aria-label={`Portada de ${title.name}`} onClick={() => setZoom(false)}
          className="anim-fade fixed inset-0 z-40 !m-0 flex cursor-zoom-out items-center justify-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={`Portada de ${title.name}`} className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Cerrar" autoFocus onClick={() => setZoom(false)}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur transition hover:bg-white/25">×</button>
        </div>
      )}

      {user && (
        <section className="space-y-2">
          <SectionTitle>Mis listas</SectionTitle>
          {myLists.length === 0
            ? <p className="text-sm text-muted">Aún no tienes listas. <Link href="/lists" className="text-accent">Crea una</Link> para guardar esta obra.</p>
            : <div className="flex flex-wrap gap-2">
                {myLists.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-field">
                    <input type="checkbox" checked={inLists.has(l.id)} onChange={(e) => toggleList(l.id, e.target.checked)} />
                    {l.name}
                  </label>
                ))}
              </div>}
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle action={
          <button type="button" onClick={() => setOldestFirst(!oldestFirst)} className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 text-xs font-semibold transition hover:border-field active:scale-95">
            <svg aria-hidden viewBox="0 0 24 24" className={`size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2] transition-transform ${oldestFirst ? "rotate-180" : ""}`}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            {oldestFirst ? "Más antiguos" : "Más nuevos"}
          </button>}>Capítulos ({chapters.length})</SectionTitle>
        {chapters.length === 0 && <Empty>Esta obra aún no tiene capítulos.</Empty>}
        {/* # | name | date | book (mark as read) | green dot (downloaded) */}
        <ul className="divide-y divide-line">
          {(oldestFirst ? [...chapters].reverse() : chapters).map((c) => {
            const isRead = read.has(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-surface">
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{c.number}</span>
                <Link href={`/read/${c.id}`} className={`min-w-0 flex-1 truncate py-2.5 ${isRead ? "text-muted" : "font-semibold"}`}>
                  {c.name || `Capítulo ${c.number}`} {!c.is_published && <Badge tone="warning">Borrador</Badge>}
                </Link>
                {c.published_at && <time className="shrink-0 font-mono text-xs text-muted" dateTime={c.published_at}>{new Date(c.published_at).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "2-digit" })}</time>}
                {user && (
                  <button type="button" aria-pressed={isRead} aria-label={`Capítulo ${c.number}: marcar como ${isRead ? "no leído" : "leído"}`} onClick={() => mark([c.id], !isRead)}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 hover:bg-line ${isRead ? "text-accent" : "text-muted"}`}>
                    <svg aria-hidden viewBox="0 0 24 24" className={`size-5 stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75] ${isRead ? "fill-accent/25" : "fill-none"}`}><path d="M12 6.5C10.3 5.2 8 4.7 4 4.7v13c4 0 6.3.5 8 1.8 1.7-1.3 4-1.8 8-1.8v-13c-4 0-6.3.5-8 1.8zM12 6.5v13" /></svg>
                  </button>
                )}
                <span className="flex size-9 shrink-0 items-center justify-center">
                  {have.has(c.id)
                    ? <span role="img" aria-label="Descargado" className="size-2.5 rounded-full bg-success" />
                    : dl.has(c.id)
                      ? <Spinner className="text-muted" />
                      : supportsOffline() && (
                        <button type="button" aria-label={`Descargar capítulo ${c.number}`} onClick={() => download(c.id)}
                          className="flex size-9 items-center justify-center rounded-full text-muted transition active:scale-95 hover:bg-line">
                          <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"><path d="M12 4v11M7 10.5l5 5 5-5M5 19h14" /></svg>
                        </button>
                      )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
