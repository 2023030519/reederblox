"use client";
import Link from "next/link";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, mediaUrl } from "@/lib/supabase";
import { CardGrid, Empty, ErrorBox, GridSkeleton, LinkButton, SectionTitle, TitleCard } from "@/components/ui";

type Card = Parameters<typeof TitleCard>[0]["t"];
type Pending = { title: Card; unread: number; firstId: string };
type Latest = { id: string; number: number; published_at: string; titles: { name: string; slug: string; cover_path: string | null } };

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : d < 30 ? `hace ${d} días` : new Date(iso).toLocaleDateString("es");
};

export default function Home() {
  const { user, ready } = useMe();

  const d = useFetch(async () => {
    const fresh = ok(await supabase.from("titles").select("id,slug,name,type,status,cover_path,chapters(count)").eq("is_published", true).order("created_at", { ascending: false }).limit(10)) as unknown as Card[];
    const latest = ok(await supabase.from("chapters").select("id,number,published_at,titles!inner(name,slug,cover_path,is_published)").eq("is_published", true).eq("titles.is_published", true).order("published_at", { ascending: false }).limit(12)) as unknown as Latest[];

    // Pending = published chapters of titles I follow that I have not read.
    const pending: Pending[] = [];
    if (user) {
      const followed = ok(await supabase.from("library_entries").select("title_id").eq("user_id", user.id).eq("status", "following")) as { title_id: string }[];
      if (followed.length) {
        const ids = followed.map((f) => f.title_id);
        // chapter_reads embedded (RLS = my rows only): avoids a .in() URL with hundreds of ids.
        const chs = ok(await supabase.from("chapters").select("id,title_id,number,chapter_reads(chapter_id)").in("title_id", ids).eq("is_published", true).order("number")) as unknown as { id: string; title_id: string; number: number; chapter_reads: { chapter_id: string }[] }[];
        const read = new Set(chs.filter((c) => c.chapter_reads.length).map((c) => c.id));
        const titles = ok(await supabase.from("titles").select("id,slug,name,type,status,cover_path").in("id", ids)) as (Card & { id: string })[];
        for (const t of titles) {
          const unread = chs.filter((c) => c.title_id === t.id && !read.has(c.id));
          if (unread.length) pending.push({ title: t, unread: unread.length, firstId: unread[0].id });
        }
      }
    }
    return { fresh, latest, pending };
  }, [user?.id]);

  if (d.error) return <ErrorBox message={d.error} />;
  if (d.loading || !ready) return <GridSkeleton />;
  const { fresh, latest, pending } = d.data!;

  return (
    <div className="space-y-12">
      {!user && (
        <section className="grid items-end gap-8 py-4 md:grid-cols-[1.4fr_1fr] md:py-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">Obra propia, sin anuncios</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-none tracking-tighter md:text-6xl">Manga y webtoons hechos por nuestros autores</h1>
            <p className="mt-5 max-w-[48ch] leading-relaxed text-muted">Guarda lo que sigues y retoma justo donde lo dejaste, en cualquier pantalla.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/biblioteca">Explorar la biblioteca</LinkButton>
              <LinkButton href="/login" variant="secondary">Entrar o crear cuenta</LinkButton>
            </div>
          </div>
          <div aria-hidden className="hidden grid-cols-3 gap-3 md:grid">
            {fresh.slice(0, 3).map((t, i) => {
              const c = mediaUrl(t.cover_path);
              return (
                <div key={t.slug} className={`aspect-[2/3] overflow-hidden rounded-2xl bg-surface ring-1 ring-line shadow-card ${i === 1 ? "-translate-y-6" : i === 2 ? "translate-y-4" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c && <img src={c} alt="" className="h-full w-full object-cover" />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {user && (
        <section className="space-y-4">
          <SectionTitle>Capítulos pendientes</SectionTitle>
          {pending.length === 0
            ? <Empty>Estás al día. Marca obras como «Siguiendo» para ver aquí lo que te falta por leer.</Empty>
            : <CardGrid>
                {pending.map((p) => (
                  <div key={p.title.slug} className="space-y-2">
                    <TitleCard t={p.title} extra={`${p.unread} sin leer`} />
                    <Link href={`/read/${p.firstId}`} className="block rounded-full bg-accent py-2 text-center text-sm font-semibold text-on-accent transition hover:brightness-110">Seguir leyendo</Link>
                  </div>
                ))}
              </CardGrid>}
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle>Últimos capítulos</SectionTitle>
        {latest.length === 0 ? <Empty>Aún no hay capítulos publicados.</Empty> :
          <ul className="grid gap-2 sm:grid-cols-2">
            {latest.map((c) => {
              const cover = mediaUrl(c.titles.cover_path);
              return (
                <li key={c.id}>
                  <Link href={`/read/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-card">
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.titles.name}</span>
                      <span className="block text-sm text-muted">Capítulo {c.number} · {ago(c.published_at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>}
      </section>

      <section className="space-y-4">
        <SectionTitle action={<Link href="/biblioteca" className="text-sm text-accent">Ver todo</Link>}>Obras nuevas</SectionTitle>
        {fresh.length === 0 ? <Empty>Todavía no hay obras. Si eres creador, publica la primera desde el Estudio.</Empty> :
          <CardGrid>{fresh.map((t) => <TitleCard key={t.slug} t={t} />)}</CardGrid>}
      </section>
    </div>
  );
}
