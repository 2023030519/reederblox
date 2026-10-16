import { readFileSync } from "node:fs";

// Finds real published content so the tests do not depend on one specific title.
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")).map(([k, ...v]) => [k, v.join("=").trim()]));
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const get = async (path: string) =>
  (await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })).json();

export async function firstPublishedChapter(): Promise<{ id: string; titleSlug: string; titleName: string } | null> {
  const rows = await get("chapters?select=id,pages!inner(id),titles!inner(slug,name,is_published)&is_published=eq.true&titles.is_published=eq.true&limit=1");
  return rows[0] ? { id: rows[0].id, titleSlug: rows[0].titles.slug, titleName: rows[0].titles.name } : null;
}

export async function firstPublishedTitle(): Promise<{ slug: string; name: string } | null> {
  const rows = await get("titles?select=slug,name&is_published=eq.true&limit=1");
  return rows[0] ?? null;
}
