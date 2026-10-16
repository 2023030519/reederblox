"use client";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { Spinner } from "@/components/ui";

const icon = "size-[18px] shrink-0 stroke-current fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]";
export const PersonIcon = () => <svg aria-hidden viewBox="0 0 24 24" className={icon}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></svg>;
export const AtIcon = () => <svg aria-hidden viewBox="0 0 24 24" className={icon}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></svg>;
export const TextIcon = () => <svg aria-hidden viewBox="0 0 24 24" className={icon}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
const BackIcon = () => <svg aria-hidden viewBox="0 0 24 24" className={`${icon} !size-6`}><path d="m15 5-7 7 7 7" /></svg>;

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const CameraIcon = () => <svg aria-hidden viewBox="0 0 24 24" className={icon}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;

export type Kind = "avatar" | "banner";

// Round button that opens the file picker; the parent does the upload.
function PhotoButton({ label, kind, busy, onPick, className }: { label: string; kind: Kind; busy: Kind | null; onPick: (k: Kind, f: File) => void; className: string }) {
  return (
    <label className={`flex cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors duration-150 hover:bg-black/80 focus-within:outline-2 focus-within:outline-accent ${className}`}>
      <span className="sr-only">{label}</span>
      {busy === kind ? <Spinner /> : <CameraIcon />}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy !== null}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(kind, f); }} />
    </label>
  );
}

export function AvatarHeader({ name, username, avatarUrl, bannerUrl, busy, onPick }: {
  name: string; username: string; avatarUrl?: string | null; bannerUrl?: string | null; busy: Kind | null; onPick: (k: Kind, f: File) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="relative -mx-5 h-32 w-[calc(100%+2.5rem)] self-stretch overflow-hidden bg-surface sm:mx-0 sm:w-full sm:rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bannerUrl && <img src={bannerUrl} alt="" className="size-full object-cover" />}
        <PhotoButton kind="banner" label="Cambiar foto de portada" busy={busy} onPick={onPick} className="absolute bottom-2 right-3 size-9" />
      </div>
      <div className="relative -mt-12">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-surface text-3xl font-semibold text-fg ring-4 ring-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl ? <img src={avatarUrl} alt={`Foto de ${name}`} className="size-full object-cover" /> : <span aria-hidden>{initials(name)}</span>}
        </div>
        <PhotoButton kind="avatar" label="Cambiar foto de perfil" busy={busy} onPick={onPick} className="absolute bottom-0 right-0 size-8" />
      </div>
      <p className="mt-3 text-lg font-bold">{name || "Sin nombre"}</p>
      <p className="text-xs text-muted">@{username}</p>
    </div>
  );
}

type FieldProps = { label: string; icon: ReactNode; hint?: ReactNode } &
  (({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>) | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>));

// Flat field: label above, icon + value, hairline underneath that lights up on focus.
export function ProfileField({ label, icon: ic, hint, multiline, ...p }: FieldProps) {
  const id = useId();
  const cls = "w-full min-w-0 bg-transparent py-3 text-[15px] text-fg outline-none placeholder:text-muted";
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      <div className={`flex gap-3 border-b border-line text-muted transition-colors duration-200 focus-within:border-accent focus-within:text-accent ${multiline ? "items-start pt-3.5" : "items-center"}`}>
        {ic}
        {multiline
          ? <textarea id={id} rows={4} {...(p as TextareaHTMLAttributes<HTMLTextAreaElement>)} className={`${cls} resize-none !pt-0 leading-relaxed`} />
          : <input id={id} {...(p as InputHTMLAttributes<HTMLInputElement>)} className={cls} />}
      </div>
      {hint && <p className="mt-1.5 text-right text-xs text-muted">{hint}</p>}
    </div>
  );
}

export type ProfileForm = { username: string; display_name: string; bio: string };

export function EditProfileScreen({ form, setForm, onSubmit, onBack, dirty, saving, msg, avatarUrl, bannerUrl, busy, onPick, memberSince }: {
  form: ProfileForm; setForm: (f: ProfileForm) => void; onSubmit: (e: React.FormEvent) => void; onBack: () => void;
  dirty: boolean; saving: boolean; msg: string; avatarUrl?: string | null; bannerUrl?: string | null;
  busy: Kind | null; onPick: (k: Kind, f: File) => void; memberSince?: string;
}) {
  const since = memberSince && new Date(memberSince).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="anim-page -mx-4 -mt-6 min-h-[calc(100dvh-3.5rem)] px-5 pb-6 sm:-mt-8 sm:rounded-3xl sm:py-6">
      <div className="mx-auto max-w-[420px]">
        <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center py-3">
          <button type="button" onClick={onBack} aria-label="Volver al perfil" className="flex size-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface"><BackIcon /></button>
          <h1 className="text-center text-[17px] font-semibold">Editar perfil</h1>
          <span />
        </header>

        <form onSubmit={onSubmit} className="mt-6 space-y-7">
          <AvatarHeader name={form.display_name} username={form.username} avatarUrl={avatarUrl} bannerUrl={bannerUrl} busy={busy} onPick={onPick} />
          <div className="space-y-5">
            <ProfileField label="Nombre que se muestra" icon={<PersonIcon />} required maxLength={60} autoComplete="name"
              value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <ProfileField label="Usuario" icon={<AtIcon />} required pattern="[a-z0-9_]{3,24}" title="3 a 24 minúsculas, números o _" autoCapitalize="none" autoComplete="username"
              hint="Minúsculas, números o _" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <ProfileField multiline label="Sobre mí" icon={<TextIcon />} maxLength={500} hint={`${form.bio.length}/500`}
              value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          <p role="status" className={`min-h-5 text-center text-sm ${msg.startsWith("Guardado") ? "text-muted" : "text-danger"}`}>{saving ? "" : msg}</p>

          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-5 bg-bg/80 px-5 py-3 backdrop-blur sm:bottom-0 sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
            <button type="submit" disabled={!dirty || saving} aria-busy={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-on-accent transition duration-150 hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100">
              {saving && <Spinner />}{saving ? "Guardando" : "Guardar"}
            </button>
          </div>
          {since && <p className="pb-2 text-center text-xs text-muted">Miembro desde {since}</p>}
        </form>
      </div>
    </div>
  );
}
