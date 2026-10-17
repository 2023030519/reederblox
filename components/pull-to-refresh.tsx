"use client";
import { useEffect, useRef, useState } from "react";
import { hardRefresh } from "@/lib/refresh";

const TRIGGER = 70; // px of pull (after resistance) that counts as a refresh
const MAX = 100;

// Pull down from the top of any screen to hard-refresh it (see lib/refresh). Scrollable layers (the reader) opt in with data-scroller.
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const scroller = useRef<HTMLElement | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const top = () => (scroller.current ? scroller.current.scrollTop : window.scrollY) <= 0;

    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (e.touches.length !== 1 || t.closest('[role="dialog"], input, textarea, select')) return;
      scroller.current = t.closest<HTMLElement>("[data-scroller]");
      start.current = top() ? e.touches[0].clientY : null;
      last.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || !top()) { last.current = 0; setPull(0); return; }
      last.current = Math.min(MAX, dy * 0.5); // resistance
      setPull(last.current);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (last.current >= TRIGGER) { setBusy(true); hardRefresh(); return; }
      setPull(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = busy ? TRIGGER : pull;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center transition-opacity duration-150"
      style={{ transform: `translateY(${shown - 44}px)`, opacity: shown > 8 ? 1 : 0 }}>
      <div className="flex size-10 items-center justify-center rounded-full border border-line bg-bg text-accent shadow-pop">
        <svg viewBox="0 0 24 24" className={`size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2] ${busy ? "animate-spin" : ""}`}
          style={busy ? undefined : { transform: `rotate(${(pull / TRIGGER) * 270}deg)` }}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" /></svg>
      </div>
    </div>
  );
}
