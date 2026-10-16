"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { confirmAsync, toast } from "@/lib/feedback";
import { Button, Empty, ErrorBox, Field, Input, Skeleton, TitleCard } from "@/components/ui";

type Card = Parameters<typeof TitleCard>[0]["t"] & { id: string };
type Full = { id: string; name: string; description: string | null; is_public: boolean; owner_id: string; profiles: { display_name: string }; list_items: { titles: Card | null }[] };

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMe();
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [msg, setMsg] = useState("");

  const d = useFetch(async () =>
    ok(await supabase.from("lists").select("*, profiles!owner_id(display_name), list_items(titles(id,slug,name,type,status,cover_path))").eq("id", id).maybeSingle()) as unknown as Full | null, [id]);

  useEffect(() => {
    if (d.data) { /* eslint-disable-line react-hooks/set-state-in-effect */ setName(d.data.name); setDesc(d.data.description ?? ""); setIsPublic(d.data.is_public); }
  }, [d.data]);

  if (d.loading && d.data === undefined) return <Skeleton className="h-40" />;
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Empty>Esa lista no existe o es privada. <Link href="/lists" className="text-accent">Ver listas</Link></Empty>;
  const l = d.data;
  const mine = user?.id === l.owner_id;
  const items = l.list_items.map((i) => i.titles).filter((t): t is Card => !!t);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("lists").update({ name, description: desc || null, is_public: isPublic, updated_at: new Date().toISOString() }).eq("id", id);
    setMsg(error ? error.message : "Guardado");
    if (error) toast(error.message, "danger"); else toast("Lista guardada");
    if (!error) d.reload();
  };

  const remove = async (titleId: string) => {
    ok(await supabase.from("list_items").delete().eq("list_id", id).eq("title_id", titleId).select());
    d.reload();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{l.name}</h1>
        <p className="text-sm text-muted">Por {l.profiles.display_name} · {l.is_public ? "Pública" : "Privada"}</p>
        {l.description && <p className="mt-2 whitespace-pre-line">{l.description}</p>}
      </div>

      {items.length === 0
        ? <Empty>Esta lista está vacía. Añade obras desde su página, en el apartado de listas.</Empty>
        : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((t) => (
              <div key={t.id} className="space-y-1">
                <TitleCard t={t} />
                {mine && <Button variant="ghost" className="w-full" onClick={() => remove(t.id)}>Quitar</Button>}
              </div>
            ))}
          </div>}

      {mine && (
        <form onSubmit={save} className="space-y-3 rounded-lg border border-line p-4">
          <h2 className="text-lg font-semibold">Editar lista</h2>
          <Field label="Nombre"><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Descripción">
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-md border border-field bg-bg p-3 text-base" />
          </Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Lista pública (cualquiera puede verla)</label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Guardar</Button>
            <Button type="button" variant="danger" onClick={async () => {
              if (!(await confirmAsync("¿Borrar esta lista? Las obras no se borran."))) return;
              ok(await supabase.from("lists").delete().eq("id", id).select());
              router.push("/lists");
            }}>Borrar lista</Button>
            <span role="status" className="text-sm text-muted">{msg}</span>
          </div>
        </form>
      )}
    </div>
  );
}
