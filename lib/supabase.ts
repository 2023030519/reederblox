import { createClient } from "@supabase/supabase-js";

// A Vercel build without the keys would ship a site pointed at localhost; fail the build instead.
if (process.env.VERCEL && !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno de Vercel.");
}

// Placeholders keep `next build` working locally before .env.local exists.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
);

export const mediaUrl = (path?: string | null) =>
  path ? supabase.storage.from("media").getPublicUrl(path).data.publicUrl : null;

export const TYPES = ["manga", "manhwa", "manhua", "webtoon", "novel", "comic", "oneshot"] as const;
export const DEMOGRAPHIES = ["shounen", "seinen", "shoujo", "josei", "kodomo"] as const;
export const STATUSES = { publishing: "En emisión", finished: "Finalizado", paused: "En pausa", cancelled: "Cancelado" } as const;
export const LIBRARY = { following: "Siguiendo", pending: "Pendiente", read: "Leído", wanted: "Lo quiero", owned: "Lo tengo", dropped: "Abandonado" } as const;

export type Title = {
  id: string; slug: string; name: string; synopsis: string; cover_path: string | null;
  type: string; demography: string | null; status: keyof typeof STATUSES; year: number | null;
  is_published: boolean; owner_id: string;
};
export type Chapter = { id: string; title_id: string; number: number; name: string | null; is_published: boolean; published_at: string | null };
