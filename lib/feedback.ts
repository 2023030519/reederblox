// Tiny event bus so any code can show a toast or ask for confirmation without prop drilling.
// The <Feedback /> component in the layout listens for these events.
export type ToastTone = "success" | "danger" | "info" | "warning";

export const toast = (text: string, tone: ToastTone = "success") => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rb:toast", { detail: { text, tone } }));
};

// Resolves true when the user confirms, false on cancel or Esc.
export const confirmAsync = (message: string, okLabel = "Borrar") =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    window.dispatchEvent(new CustomEvent("rb:confirm", { detail: { message, okLabel, resolve } }));
  });
