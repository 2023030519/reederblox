"use client";
import { useEffect } from "react";

export type ViewerItem = { src: string; alt: string };

// Full-screen preview. Arrow keys / buttons move between images; Escape, the X or a tap outside closes it.
export function ImageViewer({ items, index, onIndex, onClose }: { items: ViewerItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null && !!items[index];
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(items.length - 1, index! + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index! - 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open, index, items.length, onIndex, onClose]);

  if (!open) return null;
  const it = items[index!];
  const nav = "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-30";
  return (
    <div role="dialog" aria-modal="true" aria-label={it.alt} onClick={onClose}
      className="anim-fade fixed inset-0 z-50 !m-0 flex cursor-zoom-out items-center justify-center bg-black/90 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={it.src} alt={it.alt} className="max-h-full max-w-full rounded-xl object-contain" />
      <button type="button" aria-label="Cerrar" autoFocus onClick={onClose} className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur transition hover:bg-white/25">×</button>
      {items.length > 1 && <>
        <button type="button" aria-label="Imagen anterior" disabled={index === 0} onClick={(e) => { e.stopPropagation(); onIndex(index! - 1); }} className={`${nav} left-3`}>‹</button>
        <button type="button" aria-label="Imagen siguiente" disabled={index === items.length - 1} onClick={(e) => { e.stopPropagation(); onIndex(index! + 1); }} className={`${nav} right-3`}>›</button>
        <span className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{index! + 1} / {items.length}</span>
      </>}
    </div>
  );
}
