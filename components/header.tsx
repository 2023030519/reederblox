"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks";

// Last known sign-in, kept in localStorage. Server render assumes "signed in", so a returning user never sees "Entrar"
// flash while the session loads; the real value replaces it on hydration.
const HINT_EVENT = "rb-hint";
const hintSubscribe = (cb: () => void) => {
  addEventListener("storage", cb);
  addEventListener(HINT_EVENT, cb);
  return () => { removeEventListener("storage", cb); removeEventListener(HINT_EVENT, cb); };
};
const hintSnapshot = () => { try { return `${localStorage.getItem("rb-signed") === "1" ? 1 : 0}|${localStorage.getItem("rb-username") ?? ""}`; } catch { return "0|"; } };
const hintServer = () => "1|";

export function Header() {
  const { user, isCreator, username, ready } = useMe();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const hint = useSyncExternalStore(hintSubscribe, hintSnapshot, hintServer);
  const [hintSigned, hintName] = [hint.startsWith("1"), hint.slice(2)];
  const signed = ready ? !!user : hintSigned;
  const name = ready ? username : hintName;

  // Remember the session for the next reload.
  useEffect(() => {
    if (!ready) return;
    try {
      if (user) {
        localStorage.setItem("rb-signed", "1");
        if (username) localStorage.setItem("rb-username", username);
      } else { localStorage.removeItem("rb-signed"); localStorage.removeItem("rb-username"); }
      dispatchEvent(new Event(HINT_EVENT));
    } catch {}
  }, [ready, user, username]);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 24);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  const items = [
    { href: "/", label: "Inicio" },
    { href: "/biblioteca", label: "Biblioteca" },
    { href: "/offline", label: "Descargas" },
    ...(signed ? [{ href: "/history", label: "Historial" }] : []),
    ...(isCreator ? [{ href: "/studio", label: "Estudio" }] : []),
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (href: string) =>
    `whitespace-nowrap rounded-full px-3.5 py-2 transition hover:bg-surface ${active(href) ? "bg-fg text-bg hover:bg-fg" : "text-muted hover:text-fg"}`;

  // Mobile bottom bar: the four places used most.
  const tabs = [
    { href: "/", label: "Inicio" },
    { href: "/biblioteca", label: "Biblioteca" },
    { href: "/offline", label: "Descargas" },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <nav aria-label="Principal" className="mx-auto flex max-w-[1100px] items-center gap-1 px-4 py-2 text-sm font-medium">
          <Link href="/" aria-label="readerblox" className={`mr-6 flex items-center text-lg font-semibold tracking-tighter ${scrolled ? "logo-collapsed" : ""}`}>
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-fg text-sm font-semibold text-bg">r</span>
            <span aria-hidden className="logo-name"><span className="pl-2">readerblox</span></span>
          </Link>
          <div className="hidden flex-1 items-center justify-evenly gap-1 sm:flex">
            {items.map((i) => <Link key={i.href} href={i.href} className={link(i.href)} aria-current={active(i.href) ? "page" : undefined}>{i.label}</Link>)}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {signed
              ? (name && <Link href={`/u/${name}`} className={link(`/u/${name}`)}>Mi perfil</Link>)
              : <Link href="/login" className="rounded-full bg-accent px-4 py-2 text-on-accent transition hover:brightness-110 active:scale-[.98]">Entrar</Link>}
          </div>
        </nav>
      </header>

      <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="mx-auto grid grid-cols-4">
          {[...tabs, signed ? { href: name ? `/u/${name}` : "/", label: "Perfil" } : { href: "/login", label: "Entrar" }].map((t) => (
            <li key={t.label}>
              <Link href={t.href} aria-current={active(t.href) && t.href !== "/login" ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition ${active(t.href) ? "text-accent" : "text-muted"}`}>
                <span aria-hidden className={`h-1 w-6 rounded-full ${active(t.href) ? "bg-accent" : "bg-transparent"}`} />
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
