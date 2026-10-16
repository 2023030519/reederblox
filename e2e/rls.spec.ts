import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Security: what an anonymous visitor can and cannot do against the database.
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")).map(([k, ...v]) => [k, v.join("=").trim()]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const zero = "00000000-0000-0000-0000-000000000000";

test("anon sees only published titles and chapters", async ({ request }) => {
  const t = await (await request.get(`${url}/rest/v1/titles?select=is_published`, { headers: h })).json();
  expect(t.every((x: { is_published: boolean }) => x.is_published)).toBe(true);
  const c = await (await request.get(`${url}/rest/v1/chapters?select=is_published`, { headers: h })).json();
  expect(c.every((x: { is_published: boolean }) => x.is_published)).toBe(true);
});

test("anon cannot read private data", async ({ request }) => {
  for (const table of ["library_entries", "chapter_reads"]) {
    expect(await (await request.get(`${url}/rest/v1/${table}?select=*`, { headers: h })).json()).toEqual([]);
  }
  const lists = await (await request.get(`${url}/rest/v1/lists?select=is_public`, { headers: h })).json();
  expect(lists.every((x: { is_public: boolean }) => x.is_public)).toBe(true);
});

test("anon cannot write anything", async ({ request }) => {
  const attempts: [string, string, object][] = [
    ["POST", "titles", { owner_id: zero, name: "x", slug: "x-hack", type: "manga" }],
    ["POST", "chapters", { title_id: zero, number: 1 }],
    ["POST", "library_entries", { user_id: zero, title_id: zero, status: "read" }],
    ["POST", "comments", { title_id: zero, user_id: zero, body: "x" }],
    ["PATCH", "profiles?username=eq.rayblox", { is_creator: true }],
    ["PATCH", "titles?name=eq.test_1", { name: "hacked" }],
    ["DELETE", "titles?name=eq.test_1", {}],
  ];
  for (const [method, path, body] of attempts) {
    const r = await request.fetch(`${url}/rest/v1/${path}`, { method, headers: h, data: method === "DELETE" ? undefined : body });
    const text = await r.text();
    // Success = 2xx with changed rows. Refusals are 401/403 or 2xx with [] (RLS filtered everything).
    const changed = r.ok() && text.trim() !== "[]" && text.trim() !== "";
    expect(changed, `${method} ${path} -> ${r.status()} ${text.slice(0, 80)}`).toBe(false);
  }
});

test("anon cannot upload to storage", async ({ request }) => {
  const r = await request.post(`${url}/storage/v1/object/media/${zero}/hack.webp`, { headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/webp" }, data: "x" });
  expect(r.ok()).toBe(false);
});
