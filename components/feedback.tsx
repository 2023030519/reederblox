"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ToastTone } from "@/lib/feedback";
import { TONE, DOT } from "@/lib/tags";

type ToastItem = { id: number; text: string; tone: ToastTone };
type Ask = { message: string; okLabel: string; resolve: (v: boolean) => void };

const toneOf = { success: "success", danger: "danger", info: "info", warning: "warning" } as const;

// Toasts, the confirm dialog and the offline banner. Mounted once in the layout.
export function Feedback() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [online, setOnline] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: ToastTone }>).detail;
      const id = ++n;
      setToasts((t) => [...t.slice(-2), { id, text, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };
    const onConfirm = (e: Event) => setAsk((e as CustomEvent<Ask>).detail);
    const up = () => setOnline(true), down = () => setOnline(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    addEventListener("rb:toast", onToast); addEventListener("rb:confirm", onConfirm);
    addEventListener("online", up); addEventListener("offline", down);
    return () => {
      removeEventListener("rb:toast", onToast); removeEventListener("rb:confirm", onConfirm);
      removeEventListener("online", up); removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => { if (ask) dialog.current?.showModal(); }, [ask]);

  const close = (v: boolean) => { ask?.resolve(v); dialog.current?.close(); setAsk(null); };

  return (
    <>
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning anim-fade">
          <span>Sin conexión. Puedes leer lo que descargaste.</span>
          <Link href="/offline" className="">Ir a Descargas</Link>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`anim-toast pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-pop ${TONE[toneOf[t.tone]]}`}>
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[toneOf[t.tone]]}`} />
            {t.text}
          </div>
        ))}
      </div>

      <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); close(false); }}
        className="m-auto w-[min(92vw,24rem)] rounded-2xl border border-line bg-bg p-5 text-fg shadow-pop backdrop:bg-black/50 anim-pop">
        {ask && (
          <div className="space-y-4">
            <p className="font-medium">{ask.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => close(false)} className="min-h-10 rounded-lg border border-line bg-surface px-4 text-sm font-semibold">Cancelar</button>
              <button onClick={() => close(true)} className="min-h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-bg">{ask.okLabel}</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
