"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Keeps what you type when the page is reloaded (pull to refresh, F5): fields are saved in sessionStorage as you type
// and put back after a reload. Not restored on normal navigation, never for passwords or files.
const KEY = "rb-drafts";
const FIELDS = "input, textarea, select";
const SKIP = new Set(["password", "file", "hidden", "submit", "button", "reset", "image", "radio", "range", "color"]);

const read = (): Record<string, string> => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const write = (d: Record<string, string>) => { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch {} };

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const keyOf = (el: Field) => {
  if (el.closest("[data-no-draft]") || (el instanceof HTMLInputElement && SKIP.has(el.type))) return null;
  const name = el.getAttribute("aria-label") || el.labels?.[0]?.textContent?.trim() || ("placeholder" in el && el.placeholder) || el.name || "";
  const same = Array.from(document.querySelectorAll(FIELDS)).filter((f) => f.tagName === el.tagName && keyOfName(f as Field) === name);
  return `${location.pathname}::${el.tagName}:${(el as HTMLInputElement).type}:${name}:${same.indexOf(el)}`;
};
const keyOfName = (el: Field) => el.getAttribute("aria-label") || el.labels?.[0]?.textContent?.trim() || ("placeholder" in el && el.placeholder) || el.name || "";
const valueOf = (el: Field) => (el instanceof HTMLInputElement && el.type === "checkbox" ? String(el.checked) : el.value);

// React ignores plain .value = ..., so go through the native setter and fire the event React listens to.
function apply(el: Field, v: string) {
  if (el instanceof HTMLInputElement && el.type === "checkbox") { if (el.checked !== (v === "true")) el.click(); return; }
  if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === v)) return false; // options not loaded yet
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

export function FormMemory() {
  const path = usePathname();
  const prev = useRef(path);

  // Leaving a page drops its drafts, so they only ever come back after a reload of that same page.
  useEffect(() => {
    if (prev.current === path) return;
    const d = read();
    for (const k of Object.keys(d)) if (k.startsWith(`${prev.current}::`)) delete d[k];
    write(d);
    prev.current = path;
  }, [path]);

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const reloaded = nav?.type === "reload";
    if (!reloaded) write({}); // a fresh visit starts clean

    const save = (e: Event) => {
      const el = e.target as Field;
      if (!(el instanceof HTMLElement) || !el.matches(FIELDS) || !e.isTrusted) return; // ignore our own restore events
      const k = keyOf(el);
      if (k) write({ ...read(), [k]: valueOf(el) });
    };
    // A submitted form is done with its draft.
    const submitted = (e: Event) => {
      const d = read();
      (e.target as HTMLFormElement).querySelectorAll<Field>(FIELDS).forEach((el) => { const k = keyOf(el); if (k) delete d[k]; });
      write(d);
    };
    document.addEventListener("input", save, true);
    document.addEventListener("change", save, true);
    document.addEventListener("submit", submitted, true);

    // Fields appear as data loads, so retry for a while; wait for the page to settle so loaded data doesn't overwrite the draft.
    let timer: ReturnType<typeof setTimeout>;
    const pending = reloaded ? read() : {};
    let running = false;
    const restore = async () => {
      if (running) return;
      running = true;
      for (const el of document.querySelectorAll<Field>(FIELDS)) {
        const k = keyOf(el);
        if (!k || !(k in pending)) continue;
        if (apply(el, pending[k]) !== false) delete pending[k];
        await new Promise((r) => setTimeout(r)); // let React re-render before the next field, or handlers would use stale state
      }
      running = false;
    };
    const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(restore, 350); });
    if (reloaded) {
      obs.observe(document.body, { childList: true, subtree: true });
      timer = setTimeout(restore, 350);
    }
    const stop = setTimeout(() => obs.disconnect(), 20000);

    return () => {
      document.removeEventListener("input", save, true);
      document.removeEventListener("change", save, true);
      document.removeEventListener("submit", submitted, true);
      obs.disconnect(); clearTimeout(timer); clearTimeout(stop);
    };
  }, []);

  return null;
}
