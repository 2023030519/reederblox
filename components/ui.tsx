import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { mediaUrl, STATUSES, type Title } from "@/lib/supabase";
import { DEMO_TONE, DOT, genreClass, STATUS_TONE, TONE, TYPE_CHIP, type Tone } from "@/lib/tags";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", loading, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; loading?: boolean }) {
  const v = {
    primary: "bg-accent text-on-accent shadow-card hover:brightness-110",
    secondary: "bg-surface border border-line hover:border-field",
    danger: "bg-danger text-bg hover:brightness-110",
    ghost: "hover:bg-surface",
  }[variant];
  return (
    <button {...p} disabled={p.disabled || loading} aria-busy={loading}
      className={cx("inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-semibold transition active:-translate-y-px active:scale-[.98] disabled:opacity-50 disabled:active:scale-100", v, className)}>
      {loading ? <span className="inline-flex items-center gap-2"><Spinner />{children}</span> : children}
    </button>
  );
}

export const Spinner = ({ className }: { className?: string }) =>
  <span aria-hidden className={cx("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;

export const LinkButton = ({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) => (
  <Link href={href} className={cx("inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-semibold transition active:-translate-y-px active:scale-[.98]",
    variant === "primary" ? "bg-accent text-on-accent shadow-card hover:brightness-110" : "border border-line bg-surface hover:border-field")}>{children}</Link>
);

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={cx("min-h-10 w-full rounded-xl border border-field bg-bg px-3.5 text-base transition focus:border-accent", p.className)} />;

export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={cx("min-h-10 w-full rounded-xl border border-field bg-bg px-2.5 text-base transition focus:border-accent", p.className)} />;

export const Field = ({ label, children }: { label: string; children: ReactNode }) =>
  <label className="block space-y-1.5"><span className="text-sm font-medium text-muted">{label}</span>{children}</label>;

// ---- labels ----
export const Badge = ({ children, tone = "neutral", dot }: { children: ReactNode; tone?: Tone; dot?: boolean }) => (
  <span className={cx("inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[tone])}>
    {dot && <span aria-hidden className={cx("size-1.5 rounded-full", DOT[tone])} />}
    {children}
  </span>
);

export const TypeChip = ({ type }: { type: string }) =>
  <span className={cx("inline-flex items-center justify-center whitespace-nowrap text-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-card", TYPE_CHIP[type] ?? "bg-chip-manga")}>{type}</span>;

export const StatusBadge = ({ status }: { status: keyof typeof STATUSES }) =>
  <Badge tone={STATUS_TONE[status]} dot>{STATUSES[status]}</Badge>;

export const GenreChip = ({ name }: { name: string }) =>
  <span className={cx("genre-chip inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", genreClass(name))}>{name}</span>;

export const DemographyBadge = ({ demography }: { demography: string }) =>
  <Badge tone={DEMO_TONE[demography] ?? "neutral"}>{demography}</Badge>;

// ---- messages ----
const CALLOUT_ICON: Record<string, string> = { info: "i", success: "✓", warning: "!", danger: "×" };
export function Callout({ tone = "info", title, children, role }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "danger" ? "alert" : undefined)} className={cx("anim-pop flex gap-3 rounded-xl p-3.5 text-sm", TONE[tone])}>
      <span aria-hidden className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-bg", DOT[tone])}>{CALLOUT_ICON[tone]}</span>
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export const ErrorBox = ({ message }: { message: string }) => <Callout tone="danger">{message}</Callout>;

export const Empty = ({ children }: { children: ReactNode }) =>
  <p className="anim-fade rounded-xl border border-dashed border-line bg-surface/50 p-8 text-center text-muted">{children}</p>;

// ---- headings ----
export const PageTitle = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold tracking-tighter sm:text-3xl">{children}</h1>
    {sub && <p className="text-sm text-muted">{sub}</p>}
  </div>
);

export const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
    <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
    {action}
  </div>
);

// ---- loaders ----
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton rounded-lg", className)} aria-hidden />;

export const GridSkeleton = () =>
  <div role="status" aria-label="Cargando" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[2/3]" />)}
  </div>;

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-line">
      <div className="bar-busy h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const CardGrid = ({ children }: { children: ReactNode }) =>
  <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>;

// Initial on a calm gradient when a title has no cover yet.
const CoverFallback = ({ name }: { name: string }) => (
  <div aria-hidden className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/30 to-surface text-4xl font-bold text-accent">
    {name.trim().charAt(0).toUpperCase() || "?"}
  </div>
);

export function TitleCard({ t, extra, href }: { t: Pick<Title, "slug" | "name" | "type" | "status" | "cover_path"> & { chapters?: { count: number }[] }; extra?: string; href?: string }) {
  const cover = mediaUrl(t.cover_path);
  const n = t.chapters?.[0]?.count;
  const tone = STATUS_TONE[t.status] ?? "neutral";
  return (
    <Link href={href ?? `/title/${t.slug}`} className="group block overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line transition duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-pop hover:ring-accent/60">
      <div className="relative aspect-[2/3] overflow-hidden bg-line">
        {cover
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={cover} alt={`Portada de ${t.name}`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          : <CoverFallback name={t.name} />}
        <span className="absolute left-2 top-2"><TypeChip type={t.type} /></span>
        {extra && <span className="anim-pop absolute bottom-2 left-2 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent shadow-card">{extra}</span>}
      </div>
      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{t.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className={cx("size-2 rounded-full", DOT[tone])} />
          {STATUSES[t.status]}{n !== undefined && ` · ${n} ${n === 1 ? "cap" : "caps"}`}
        </p>
      </div>
    </Link>
  );
}

// Same look as TitleCard, but a button: used where tapping opens something on the page instead of navigating.
export function CoverCard({ name, cover, type, sub, dot, onClick }: { name: string; cover: string | null; type?: string; sub: string; dot?: Tone; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group block w-full overflow-hidden rounded-2xl bg-surface text-left shadow-card ring-1 ring-line transition duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-pop hover:ring-accent/60">
      <div className="relative aspect-[2/3] overflow-hidden bg-line">
        {cover
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={cover} alt={`Portada de ${name}`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          : <CoverFallback name={name} />}
        {type && <span className="absolute left-2 top-2"><TypeChip type={type} /></span>}
      </div>
      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          {dot && <span aria-hidden className={cx("size-2 rounded-full", DOT[dot])} />}
          {sub}
        </p>
      </div>
    </button>
  );
}
