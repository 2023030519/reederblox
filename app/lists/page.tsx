"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { Badge, Button, Empty, ErrorBox, Field, Input, Skeleton } from "@/components/ui";

type ListRow = { id: string; name: string; is_public: boolean; owner_id: string; profiles: { display_name: string }; list_items: { count: number }[] };

export default function Lists() {
  const { user, ready } = useMe();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  // RLS returns my lists (public or not) plus other people's public ones.
  const d = useFetch(async () =>
    ok(await supabase.from("lists").select("id,name,is_public,owner_id,profiles!owner_id(display_name),list_items(count)").order("created_at", { ascending: false })) as unknown as ListRow[], [user?.id]);

  if (!ready || (d.loading && !d.data)) return <Skeleton className="h-40" />;
  if (d.error) return <ErrorBox message={d.error} />;
  const mine = d.data?.filter((l) => l.owner_id === user?.id) ?? [];
  const others = d.data?.filter((l) => l.owner_id !== user?.id) ?? [];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    const { data, error } = await supabase.from("lists").insert({ owner_id: user.id, name }).select("id").single();
    if (error) return setError(error.message);
    router.push(`/lists/${data.id}`);
  };

  const Row = ({ l }: { l: ListRow }) => (
    <li>
      <Link href={`/lists/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <span>{l.name} <span className="text-sm text-muted">· {l.list_items[0]?.count ?? 0} obras{l.owner_id !== user?.id && ` · por ${l.profiles.display_name}`}</span></span>
        {l.owner_id === user?.id && <Badge>{l.is_public ? "Pública" : "Privada"}</Badge>}
      </Link>
    </li>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Listas</h1>
      {user ? (
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Nombre de la lista nueva"><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button type="submit">Crear lista</Button>
        </form>
      ) : <Empty>Entra para crear tus propias listas. <Link href="/login" className="text-accent">Entrar</Link></Empty>}
      {error && <ErrorBox message={error} />}
      {user && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Mis listas</h2>
          {mine.length === 0 ? <Empty>Aún no tienes listas.</Empty> : <ul className="divide-y divide-line">{mine.map((l) => <Row key={l.id} l={l} />)}</ul>}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Listas públicas</h2>
        {others.length === 0 ? <Empty>Nadie ha publicado listas todavía.</Empty> : <ul className="divide-y divide-line">{others.map((l) => <Row key={l.id} l={l} />)}</ul>}
      </section>
    </div>
  );
}
