"use client";
import { useEffect, useState } from "react";
import { getSaved, removeSaved, saveChapter, supportsOffline } from "@/lib/offline";
import { confirmAsync, toast } from "@/lib/feedback";
import { Spinner } from "./ui";

// Download / saved / remove, in one button. `compact` is the small version for chapter rows.
export function OfflineButton({ chapterId, compact, onChange }: { chapterId: string; compact?: boolean; onChange?: () => void }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  useEffect(() => {
    let live = true;
    if (!supportsOffline()) return;
    getSaved(chapterId).then((s) => live && setSaved(!!s), () => live && setSaved(false));
    return () => { live = false; };
  }, [chapterId]);

  if (!supportsOffline() || saved === null) return null;

  const base = `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition active:scale-[.97] disabled:opacity-60 ${compact ? "min-h-9 px-2.5" : "min-h-10 px-3"}`;

  if (progress) {
    return <span role="status" className={`${base} bg-accent-soft text-accent`}><Spinner />{progress[0]}/{progress[1]}</span>;
  }

  if (saved) {
    return (
      <button type="button" className={`${base} bg-success-soft text-success`} aria-label="Quitar la descarga de este capítulo"
        onClick={async () => {
          if (!(await confirmAsync("¿Quitar este capítulo de tus descargas?", "Quitar"))) return;
          await removeSaved(chapterId);
          setSaved(false); onChange?.(); toast("Descarga eliminada", "info");
        }}>
        ✓ {compact ? "" : "Descargado"}
      </button>
    );
  }

  return (
    <button type="button" className={`${base} border border-line bg-surface hover:border-field`} aria-label="Descargar este capítulo para leerlo sin conexión"
      onClick={async () => {
        setProgress([0, 1]);
        try {
          await saveChapter(chapterId, (d, t) => setProgress([d, t]));
          setSaved(true); onChange?.(); toast("Capítulo guardado para leer sin conexión");
        } catch (e) {
          toast((e as Error).message, "danger");
        }
        setProgress(null);
      }}>
      ↓ {compact ? "" : "Descargar"}
    </button>
  );
}
