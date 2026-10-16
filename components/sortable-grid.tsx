"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props<T> = {
  items: T[];
  getKey: (t: T) => string;
  onReorder: (next: T[]) => void;
  renderItem: (t: T, index: number) => ReactNode;
  className?: string;
  disabled?: boolean;
};

// Drag-to-reorder grid on pointer events, so it works with mouse and touch.
// Mouse: drag after 5px. Touch: press and hold ~0.2s, then drag (a quick swipe still scrolls the page).
// Buttons/links inside an item keep working (they never start a drag).
export function SortableGrid<T>({ items, getKey, onReorder, renderItem, className, disabled }: Props<T>) {
  const ol = useRef<HTMLOListElement>(null);
  const [order, setOrder] = useState<T[] | null>(null); // live order while dragging
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null);
  const latest = useRef({ items, getKey, onReorder, disabled });
  useEffect(() => { latest.current = { items, getKey, onReorder, disabled }; });

  useEffect(() => {
    const el = ol.current;
    if (!el) return;
    const s = { endedAt: 0, pid: -1, sx: 0, sy: 0, key: "", touch: false, active: false, grab: { x: 0, y: 0 }, p: { x: 0, y: 0 }, order: [] as T[], timer: undefined as ReturnType<typeof setTimeout> | undefined, tick: undefined as ReturnType<typeof setInterval> | undefined };

    const kids = () => Array.from(el.children) as HTMLElement[];
    // offsetLeft/Top ignore transforms, so slots stay put while the dragged item is translated.
    const slots = () => {
      const box = el.getBoundingClientRect();
      return kids().map((k) => ({ l: box.left + k.offsetLeft, t: box.top + k.offsetTop, w: k.offsetWidth, h: k.offsetHeight, key: k.dataset.key! }));
    };

    const update = () => {
      if (!s.active) return;
      const sl = slots();
      const cur = sl.findIndex((x) => x.key === s.key);
      if (cur < 0) return;
      let target = sl.findIndex((x) => s.p.x >= x.l && s.p.x <= x.l + x.w && s.p.y >= x.t && s.p.y <= x.t + x.h);
      // Skip while React hasn't rendered the previous swap yet.
      const inSync = sl.every((x, i) => x.key === latest.current.getKey(s.order[i]));
      if (target >= 0 && target !== cur && inSync) {
        const from = s.order.findIndex((o) => latest.current.getKey(o) === s.key);
        s.order = [...s.order];
        s.order.splice(target, 0, s.order.splice(from, 1)[0]);
        setOrder(s.order);
      } else target = cur;
      const c = sl[target];
      setDrag({ key: s.key, x: s.p.x - s.grab.x - (c.l + c.w / 2), y: s.p.y - s.grab.y - (c.t + c.h / 2) });
    };

    const begin = () => {
      const sl = slots();
      const me = sl.find((x) => x.key === s.key);
      if (!me) return;
      s.active = true;
      s.order = [...latest.current.items];
      s.grab = { x: s.p.x - (me.l + me.w / 2), y: s.p.y - (me.t + me.h / 2) };
      setOrder(s.order);
      setDrag({ key: s.key, x: 0, y: 0 });
      // Keep scrolling near the screen edges even when the finger holds still.
      s.tick = setInterval(() => {
        if (s.p.y < 90) scrollBy(0, -14); else if (s.p.y > innerHeight - 90) scrollBy(0, 14);
        update();
      }, 16);
    };

    const end = (commit: boolean) => {
      clearTimeout(s.timer);
      clearInterval(s.tick);
      const was = s.active;
      if (was) s.endedAt = Date.now();
      s.active = false; s.pid = -1;
      if (was && commit) {
        const before = latest.current.items.map(latest.current.getKey).join("|");
        if (s.order.map(latest.current.getKey).join("|") !== before) latest.current.onReorder(s.order);
      }
      setDrag(null); setOrder(null);
    };

    const down = (e: PointerEvent) => {
      if (latest.current.disabled || s.active || s.pid !== -1) return;
      const t = e.target as HTMLElement;
      const li = t.closest<HTMLElement>("[data-key]");
      if (!li || t.closest("button, a, input, select, textarea") || (e.pointerType === "mouse" && e.button !== 0)) return;
      s.pid = e.pointerId; s.key = li.dataset.key!; s.touch = e.pointerType !== "mouse";
      s.sx = s.p.x = e.clientX; s.sy = s.p.y = e.clientY;
      if (s.touch) s.timer = setTimeout(begin, 220);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== s.pid) return;
      s.p = { x: e.clientX, y: e.clientY };
      if (!s.active) {
        const d = Math.hypot(s.p.x - s.sx, s.p.y - s.sy);
        if (s.touch) { if (d > 8) { clearTimeout(s.timer); s.pid = -1; } } // the finger is scrolling
        else if (d > 5) begin();
        return;
      }
      update();
    };
    const up = (e: PointerEvent) => { if (e.pointerId === s.pid) end(e.type === "pointerup"); };
    const block = (e: TouchEvent) => { if (s.active) e.preventDefault(); }; // no page scroll while dragging

    const swallow = (e: Event) => { if (Date.now() - s.endedAt < 300) { e.stopPropagation(); e.preventDefault(); } };
    el.addEventListener("click", swallow, true);
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    addEventListener("touchmove", block, { passive: false });
    return () => {
      end(false);
      el.removeEventListener("click", swallow, true);
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      removeEventListener("touchmove", block);
    };
  }, []);

  const list = order ?? items;
  return (
    <ol ref={ol} className={`relative ${className ?? ""}`}>
      {list.map((t, i) => {
        const key = getKey(t);
        const dragging = drag?.key === key;
        return (
          <li key={key} data-key={key} onDragStart={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
            style={dragging ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.05)`, transition: "none" } : undefined}
            className={`select-none [-webkit-touch-callout:none] ${dragging ? "relative z-30 cursor-grabbing opacity-90 shadow-pop" : disabled ? "" : "cursor-grab"}`}>
            {renderItem(t, i)}
          </li>
        );
      })}
    </ol>
  );
}
