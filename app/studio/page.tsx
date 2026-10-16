"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, TYPES, type Title } from "@/lib/supabase";
import { Button, CardGrid, Empty, ErrorBox, Field, Input, Select, Skeleton, TitleCard } from "@/components/ui";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Studio() {
  const { user, isCreator, ready } = useMe();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("manga");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mine = useFetch(async () =>
    user ? ok(await supabase.from("titles").select("id,slug,name,type,status,cover_path,is_published,chapters(count)").eq("owner_id", user.id).order("created_at", { ascending: false })) as unknown as (Pick<Title, "id" | "slug" | "name" | "type" | "status" | "cover_path" | "is_published"> & { chapters: { count: number }[] })[] : [],
  [user?.id]);

  if (!ready) return <Skeleton className="h-24" />;
  if (!user) return <Empty>Entra para usar el estudio. <Link href="/login" className="text-accent">Entrar</Link></Empty>;
  if (!isCreator) return <Empty>Tu cuenta aún no es de creador. Pídele al administrador que la active.</Empty>;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    // A short random suffix keeps slugs unique without a lookup round trip.
    const slug = `${slugify(name) || "obra"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from("titles").insert({ owner_id: user.id, name, type, slug }).select("id").single();
    setBusy(false);
    if (error) return setError(error.message);
    router.push(`/studio/${data.id}`);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Estudio</h1>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field label="Nombre de la obra nueva"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Button type="submit" loading={busy}>Crear</Button>
      </form>
      {error && <ErrorBox message={error} />}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mis obras</h2>
        {mine.error && <ErrorBox message={mine.error} />}
        {mine.data?.length === 0 && <Empty>Todavía no tienes obras. Crea la primera arriba.</Empty>}
        {mine.data && mine.data.length > 0 && (
          <CardGrid>
            {mine.data.map((t) => <TitleCard key={t.id} t={t} href={`/studio/${t.id}`} extra={t.is_published ? undefined : "Borrador"} />)}
          </CardGrid>
        )}
      </section>
    </div>
  );
}
