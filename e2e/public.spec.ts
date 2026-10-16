import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { firstPublishedChapter, firstPublishedTitle } from "./data";

// Every screen: no console errors, no 5xx, no serious accessibility violations.
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));
  return problems;
}

for (const path of ["/", "/biblioteca", "/lists", "/login", "/faq", "/normas"]) {
  test(`${path}: loads clean and accessible`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const axe = await new AxeBuilder({ page }).analyze();
    const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test("F01 anonymous: directory -> title -> reader", async ({ page }) => {
  const c = await firstPublishedChapter();
  test.skip(!c, "no published title with a chapter and pages in the database");
  const problems = watch(page);
  await page.goto("/biblioteca");
  await page.getByLabel("Buscar por título").fill(c!.titleName);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await page.locator(`a[href="/title/${c!.titleSlug}"]`).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator("a[href^='/read/']").first().click();
  await expect(page.locator("img[alt^='Página']").first()).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  expect(problems).toEqual([]);
});

test("F04 directory: filter with no match shows the empty state", async ({ page }) => {
  await page.goto("/biblioteca");
  await page.getByLabel("Buscar por título").fill("zzzz-no-existe");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText("Nada coincide con esos filtros")).toBeVisible();
});

test("F04 directory: search finds a title", async ({ page }) => {
  const t = await firstPublishedTitle();
  test.skip(!t, "no published title in the database");
  await page.goto("/biblioteca");
  await page.getByLabel("Buscar por título").fill(t!.name);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator(`a[href="/title/${t!.slug}"]`)).toBeVisible();
});

test("unknown title and chapter show friendly messages", async ({ page }) => {
  await page.goto("/title/no-existe-xyz");
  await expect(page.getByText("No encontramos esa obra")).toBeVisible();
  await page.goto("/read/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("Capítulo no encontrado")).toBeVisible();
});

test("studio, history need login", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByText("Entra para usar el estudio")).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText("Entra para ver tu historial")).toBeVisible();
});

test("studio title page asks anonymous visitors to log in (B05)", async ({ page }) => {
  await page.goto("/studio/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("Entra para usar el estudio")).toBeVisible();
});

test("form fields use the theme text colour in dark mode (B07)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/biblioteca");
  const color = await page.getByLabel("Tipo").evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(236, 238, 242)"); // --c-text in dark
});

test("the app is installable: manifest and icons are served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true);
});
