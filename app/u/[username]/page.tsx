"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFetch, useMe, ok } from "@/lib/hooks";
import { supabase, mediaUrl } from "@/lib/supabase";
import { toWebp } from "@/lib/image";
import { toast } from "@/lib/feedback";
import { Empty, ErrorBox, Skeleton, TitleCard } from "@/components/ui";
import { EditProfileScreen } from "@/components/edit-profile";

type Card = Parameters<typeof TitleCard>[0]["t"];
type Profile = { id: string; username: string; display_name: string; bio: string | null; is_creator: boolean; avatar_url: string | null; banner_url: string | null; created_at: string };
type Kind = "avatar" | "banner";

export default function Creator() {
  const { username } = useParams<{ username: string }>();
  const { user } = useMe();
  const router = useRouter();
  const [form, setForm] = useState({ username: "", display_name: "", bio: "" });
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [view, setView] = useState<string | null>(null); // photo shown full size

  useEffect(() => {
    if (!view) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [view]);

  const d = useFetch(async () => {
    const profile = ok(await supabase.from("profiles").select("id,username,display_name,bio,is_creator,avatar_url,banner_url,created_at").eq("username", username).maybeSingle()) as Profile | null;
    if (!profile) return null;
    const titles = ok(await supabase.from("titles").select("id,slug,name,type,status,cover_path,chapters(count)").eq("owner_id", profile.id).eq("is_published", true).order("created_at", { ascending: false })) as unknown as Card[];
    return { profile, titles };
  }, [username]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d.data) setForm({ username: d.data.profile.username, display_name: d.data.profile.display_name, bio: d.data.profile.bio ?? "" });
  }, [d.data]);

  if (d.loading && d.data === undefined) return <Skeleton className="h-40" />;
  if (d.error) return <ErrorBox message={d.error} />;
  if (!d.data) return <Empty>No existe nadie con ese usuario. <Link href="/" className="text-accent">Ir al inicio</Link></Empty>;
  const { profile, titles } = d.data;
  const mine = user?.id === profile.id;
  const dirty = form.username !== profile.username || form.display_name !== profile.display_name || form.bio !== (profile.bio ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Guardando…");
    const { error } = await supabase.from("profiles").update({ username: form.username, display_name: form.display_name, bio: form.bio || null }).eq("id", profile.id);
    if (error) return setMsg(error.code === "23505" ? "Ese usuario ya existe." : error.code === "23514" ? "El usuario debe tener 3 a 24 letras minúsculas, números o _." : error.message);
    setMsg("Guardado"); toast("Perfil guardado"); setEditing(false);
    if (form.username !== profile.username) router.replace(`/u/${form.username}`);
    else d.reload();
  };

  // Uploads straight away and stores the storage path, like titles.cover_path.
  const pick = async (kind: Kind, file: File) => {
    setBusy(kind); setMsg("");
    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const path = `${profile.id}/profile/${kind}-${crypto.randomUUID()}.webp`;
    try {
      const { blob } = await toWebp(file, kind === "avatar" ? 512 : 1600);
      const up = await supabase.storage.from("media").upload(path, blob, { contentType: "image/webp" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("profiles").update({ [col]: path }).eq("id", profile.id);
      if (error) { await supabase.storage.from("media").remove([path]); throw error; }
      const old = profile[col];
      if (old?.startsWith(`${profile.id}/`)) supabase.storage.from("media").remove([old]).catch(() => {});
      toast(kind === "avatar" ? "Foto actualizada" : "Portada actualizada");
      d.reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo subir la imagen"); }
    finally { setBusy(null); }
  };

  if (mine && editing) return (
    <EditProfileScreen form={form} setForm={setForm} onSubmit={save} onBack={() => { setEditing(false); setMsg(""); }}
      dirty={dirty} saving={msg === "Guardando…"} msg={msg} avatarUrl={mediaUrl(profile.avatar_url)} bannerUrl={mediaUrl(profile.banner_url)}
      busy={busy} onPick={pick} memberSince={profile.created_at} />
  );

  const avatar = mediaUrl(profile.avatar_url), banner = mediaUrl(profile.banner_url);
  return (
    <div className="space-y-8">
      <div>
        <button type="button" disabled={!banner} onClick={() => banner && setView(banner)} aria-label="Ver foto de portada"
          className="-mx-4 -mt-6 block h-32 w-[calc(100%+2rem)] overflow-hidden bg-surface enabled:cursor-zoom-in sm:mx-0 sm:mt-0 sm:h-44 sm:w-full sm:rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {banner && <img src={banner} alt="" className="size-full object-cover" />}
        </button>
        <div className="-mt-10 flex items-end justify-between gap-3">
          <button type="button" disabled={!avatar} onClick={() => avatar && setView(avatar)} aria-label="Ver foto de perfil"
            className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-surface text-2xl font-semibold ring-4 ring-bg enabled:cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar ? <img src={avatar} alt={`Foto de ${profile.display_name}`} className="size-full object-cover" /> : <span aria-hidden>{profile.display_name.trim().charAt(0).toUpperCase()}</span>}
          </button>
          {mine && (
            <div className="flex gap-2">
              <button type="button" aria-label="Editar perfil" onClick={() => { setMsg(""); setEditing(true); }}
                className="flex size-10 items-center justify-center rounded-full border border-line bg-surface transition active:scale-95 hover:border-field">
                <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
              </button>
              <Link href="/settings" aria-label="Ajustes"
                className="flex size-10 items-center justify-center rounded-full border border-line bg-surface transition active:scale-95 hover:border-field">
                <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              </Link>
            </div>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold">{profile.display_name}</h1>
        <p className="text-sm text-muted">@{profile.username}{profile.is_creator && " · Creador"}</p>
        {profile.bio && <p className="mt-2 whitespace-pre-line">{profile.bio}</p>}
        {mine && profile.is_creator && <Link href="/studio" className="mt-3 inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-line bg-surface px-5 text-sm font-semibold transition hover:border-field active:scale-[.98]">Estudio</Link>}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Obras</h2>
        {titles.length === 0
          ? <Empty>{mine ? "Aún no has publicado obras." : "Todavía no tiene obras publicadas."}</Empty>
          : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {titles.map((t) => <TitleCard key={t.slug} t={t} />)}
            </div>}
      </section>
      {view && (
        <div role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setView(null)} className="anim-fade fixed inset-0 z-40 !m-0 flex cursor-zoom-out items-center justify-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Cerrar" autoFocus onClick={() => setView(null)} className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur transition hover:bg-white/25">×</button>
        </div>
      )}
    </div>
  );
}
