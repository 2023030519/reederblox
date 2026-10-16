// Full class names on purpose: Tailwind only generates classes it can find as literal strings.
export type Tone = "accent" | "info" | "success" | "warning" | "danger" | "pink" | "teal" | "neutral";

export const TONE: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  pink: "bg-pink-soft text-pink",
  teal: "bg-teal-soft text-teal",
  neutral: "bg-surface text-muted border border-line",
};

export const DOT: Record<Tone, string> = {
  accent: "bg-accent", info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", pink: "bg-pink", teal: "bg-teal", neutral: "bg-muted",
};

// Solid chips (white text) for the corner of a cover; same colour in light and dark.
export const TYPE_CHIP: Record<string, string> = {
  manga: "bg-chip-manga", manhwa: "bg-chip-manhwa", manhua: "bg-chip-manhua", webtoon: "bg-chip-webtoon",
  novel: "bg-chip-novel", comic: "bg-chip-comic", oneshot: "bg-chip-oneshot",
};

export const STATUS_TONE: Record<string, Tone> = { publishing: "success", finished: "info", paused: "warning", cancelled: "danger" };
export const DEMO_TONE: Record<string, Tone> = { shounen: "info", seinen: "teal", shoujo: "pink", josei: "accent", kodomo: "warning" };

// Single source of truth for genre colours; classes are defined in app/globals.css. Unknown genres fall back to neutral.
const GENRE_CLASS: Record<string, string> = {
  accion: "g-orange", aventura: "g-green", comedia: "g-amber", drama: "g-slate", fantasia: "g-violet", romance: "g-pink",
  terror: "g-red", misterio: "g-teal", "ciencia-ficcion": "g-sky", "slice-of-life": "g-green", deportes: "g-orange", historico: "g-slate",
};
export const genreClass = (name: string) =>
  GENRE_CLASS[name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-")] ?? "g-neutral";
