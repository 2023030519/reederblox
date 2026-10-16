"use client";
import { useState } from "react";
import { useFetch, ok } from "@/lib/hooks";
import { supabase, DEMOGRAPHIES, STATUSES, TYPES } from "@/lib/supabase";
import { Button, Empty, ErrorBox, Field, GridSkeleton, Input, LinkButton, Select, TitleCard } from "@/components/ui";

const PER_PAGE = 20;
const SORTS = { new: "Más nuevos", az: "A–Z" } as const;

export default function Library() {
  const [f, setF] = useState({ q: "", type: "", demography: "", status: "", genre: "", sort: "new" as keyof typeof SORTS });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(0);

  const genres = useFetch(async () => ok(await supabase.from("genres").select("id,name").order("name")) as { id: string; name: string }[], []);

  const res = useFetch(async () => {
    // inner join only when filtering by genre, otherwise titles without genres would vanish
    let q = supabase.from("titles")
      .select(`id,slug,name,type,status,cover_path,chapters(count)${applied.genre ? ",title_genres!inner(genre_id)" : ""}`, { count: "exact" })
      .eq("is_published", true);
    if (applied.q) q = q.ilike("name", `%${applied.q.replace(/[%_]/g, "")}%`);
    if (applied.type) q = q.eq("type", applied.type);
    if (applied.demography) q = q.eq("demography", applied.demography);
    if (applied.status) q = q.eq("status", applied.status);
    if (applied.genre) q = q.eq("title_genres.genre_id", applied.genre);
    q = applied.sort === "az" ? q.order("name") : q.order("created_at", { ascending: false });
    const r = await q.range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
    if (r.error) throw new Error(r.error.message);
    return { rows: r.data as unknown as Parameters<typeof TitleCard>[0]["t"][], count: r.count ?? 0 };
  }, [applied, page]);

  const pages = Math.max(1, Math.ceil((res.data?.count ?? 0) / PER_PAGE));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Biblioteca</h1>
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(f); }} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 md:col-span-4"><Field label="Buscar por título"><Input type="search" value={f.q} onChange={set("q")} /></Field></div>
        <Field label="Tipo"><Select value={f.type} onChange={set("type")}><option value="">Todos</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Demografía"><Select value={f.demography} onChange={set("demography")}><option value="">Todas</option>{DEMOGRAPHIES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Estado"><Select value={f.status} onChange={set("status")}><option value="">Todos</option>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Género"><Select value={f.genre} onChange={set("genre")}><option value="">Todos</option>{genres.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
        <Field label="Orden"><Select value={f.sort} onChange={set("sort")}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-3">
          <Button type="submit">Aplicar filtros</Button>
          <Button type="button" variant="ghost" onClick={() => { const z = { q: "", type: "", demography: "", status: "", genre: "", sort: "new" as const }; setF(z); setApplied(z); setPage(0); }}>Limpiar</Button>
          <LinkButton href="/lists" variant="secondary">Listas</LinkButton>
        </div>
      </form>

      {res.error && <ErrorBox message={res.error} />}
      {res.loading && <GridSkeleton />}
      {res.data && res.data.rows.length === 0 && <Empty>Nada coincide con esos filtros. Prueba a limpiarlos.</Empty>}
      {res.data && res.data.rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {res.data.rows.map((t) => <TitleCard key={t.slug} t={t} />)}
        </div>
      )}
      <nav aria-label="Paginación" className="flex items-center justify-between">
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>« Anterior</Button>
        <span className="text-sm text-muted">Página {page + 1} de {pages}</span>
        <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente »</Button>
      </nav>
    </div>
  );
}
