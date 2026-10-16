"use client";
import Link from "next/link";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";

type Row = { read_at: string; chapters: { id: string; number: number; titles: { name: string } } };

export default function History() {
  const { user, ready } = useMe();
  const d = useFetch(async () => user
    ? ok(await supabase.from("chapter_reads").select("read_at, chapters(id,number,titles(name))").eq("user_id", user.id).order("read_at", { ascending: false }).limit(50)) as unknown as Row[]
    : [], [user?.id]);

  if (!ready || d.loading) return <Skeleton className="h-40" />;
  if (!user) return <Empty>Entra para ver tu historial. <Link href="/login" className="text-accent">Entrar</Link></Empty>;
  if (d.error) return <ErrorBox message={d.error} />;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Historial</h1>
      {d.data?.length === 0 ? <Empty>Aún no has leído nada.</Empty> :
        <ul className="divide-y divide-line">
          {d.data?.map((r) => (
            <li key={r.chapters.id}>
              <Link href={`/read/${r.chapters.id}`} className="flex justify-between gap-3 py-2">
                <span>{r.chapters.titles.name} · Cap. {r.chapters.number}</span>
                <time className="text-sm text-muted" dateTime={r.read_at}>{new Date(r.read_at).toLocaleString("es")}</time>
              </Link>
            </li>
          ))}
        </ul>}
    </div>
  );
}
