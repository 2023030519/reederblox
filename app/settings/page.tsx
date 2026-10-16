"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/feedback";
import { Button, PageTitle } from "@/components/ui";

const MODES = [
  { id: "dark", label: "Oscuro" }, { id: "light", label: "Claro" }, { id: "sepia", label: "Sepia" },
  { id: "midnight", label: "Medianoche" }, { id: "amoled", label: "Negro" },
];
const ACCENTS = [
  { id: "rose", label: "Rojo", swatch: "#e11d48" },
  { id: "orange", label: "Naranja", swatch: "#f97316" },
  { id: "emerald", label: "Verde", swatch: "#10b981" },
  { id: "blue", label: "Azul", swatch: "#0ea5e9" },
  { id: "violet", label: "Morado", swatch: "#8b5cf6" },
  { id: "zinc", label: "Gris", swatch: "#71717a" },
  { id: "navy", label: "Noche", swatch: "#0a0e1e" },
  { id: "pink", label: "Rosa", swatch: "#ec4899" },
  { id: "amber", label: "Amarillo", swatch: "#f59e0b" },
  { id: "teal", label: "Turquesa", swatch: "#14b8a6" },
  { id: "indigo", label: "Índigo", swatch: "#6366f1" },
];

// Native <details>: keyboard and screen-reader friendly, no state to manage.
function Fold({ title, top, defaultOpen, children }: { title: string; top?: boolean; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className={`group ${top ? "rounded-2xl border border-line px-4" : "border-t border-line first:border-t-0"}`}>
      <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden ${top ? "text-lg tracking-tight" : "text-sm text-muted"}`}>
        {title}
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2] transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="space-y-4 pb-4">{children}</div>
    </details>
  );
}

const row = "flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left transition hover:text-accent";
const html = () => document.documentElement;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

// What the page looks like right now (saved choice, or the OS theme when none was saved).
const current = () => ({
  mode: html().getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  accent: html().getAttribute("data-accent") ?? "rose",
});

export default function Settings() {
  const { user } = useMe();
  const router = useRouter();
  const [saved, setSaved] = useState({ mode: "dark", accent: "rose" });
  const [draft, setDraft] = useState(saved);
  const applied = useRef(false);

  useEffect(() => {
    const now = current();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(now); setDraft(now);
    // Leaving without "Aplicar" drops the preview and restores what was saved.
    return () => {
      if (applied.current) return;
      const t = read("theme");
      if (t) html().setAttribute("data-theme", t); else html().removeAttribute("data-theme");
      html().setAttribute("data-accent", read("accent") ?? "rose");
    };
  }, []);

  const preview = (next: { mode: string; accent: string }) => {
    setDraft(next);
    applied.current = false;
    html().setAttribute("data-theme", next.mode);
    html().setAttribute("data-accent", next.accent);
  };
  const apply = () => {
    try { localStorage.setItem("theme", draft.mode); localStorage.setItem("accent", draft.accent); } catch {}
    applied.current = true;
    setSaved(draft);
    toast("Cambios aplicados");
  };
  const dirty = draft.mode !== saved.mode || draft.accent !== saved.accent;

  const signOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  return (
    <div className="anim-page mx-auto max-w-[480px] space-y-8">
      <PageTitle>Ajustes</PageTitle>

      <Fold title="Temas" top>
        <Fold title="Modo" defaultOpen>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo">
            {MODES.map((m) => (
              <label key={m.id} className="cursor-pointer">
                <input type="radio" name="mode" value={m.id} checked={draft.mode === m.id} onChange={() => preview({ ...draft, mode: m.id })} className="peer sr-only" />
                <span className="flex min-h-11 items-center justify-center rounded-full border border-line text-sm font-semibold transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{m.label}</span>
              </label>
            ))}
          </div>
        </Fold>
        <Fold title="Colores" defaultOpen>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colores">
            {ACCENTS.map((a) => (
              <label key={a.id} className="cursor-pointer">
                <input type="radio" name="accent" value={a.id} checked={draft.accent === a.id} onChange={() => preview({ ...draft, accent: a.id })} className="peer sr-only" />
                <span className="block size-10 rounded-full border border-white/20 ring-2 ring-transparent ring-offset-2 ring-offset-bg transition peer-checked:ring-fg peer-focus-visible:ring-accent" style={{ background: a.swatch }} />
                <span className="sr-only">{a.label}</span>
              </label>
            ))}
          </div>
        </Fold>
        <Button className="w-full" disabled={!dirty} onClick={apply}>Aplicar cambios</Button>
      </Fold>

      <ul className="divide-y divide-line border-y border-line">
        <li><Link href="/faq" className={row}>Preguntas frecuentes<span aria-hidden className="text-muted">›</span></Link></li>
        <li><Link href="/normas" className={row}>Normas<span aria-hidden className="text-muted">›</span></Link></li>
        {user && <li><button onClick={signOut} className={`${row} text-danger hover:text-danger`}>Salir</button></li>}
      </ul>
    </div>
  );
}
