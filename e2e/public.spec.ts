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

test("reader zoom: buttons and a two-finger pinch widen the pages", async ({ page }) => {
  const c = await firstPublishedChapter();
  test.skip(!c, "no published chapter with pages in the database");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/read/${c!.id}`);
  const strip = page.locator("[data-page]").first();
  await expect(strip).toBeVisible();
  const w0 = (await strip.boundingBox())!.width;

  await page.getByRole("button", { name: "Acercar" }).click();
  await expect(page.getByRole("button", { name: /restablecer zoom/ })).toHaveText("125%");
  expect((await strip.boundingBox())!.width).toBeCloseTo(w0 * 1.25, 0);

  // Pinch out with two fingers (the browser's own pinch is off in real fullscreen).
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", d: number) => cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchEnd" ? [] : [{ x: 195 - d, y: 400, id: 1 }, { x: 195 + d, y: 400, id: 2 }],
  });
  await touch("touchStart", 50);
  for (const d of [70, 90, 100]) await touch("touchMove", d);
  await touch("touchEnd", 0);
  expect((await strip.boundingBox())!.width).toBeGreaterThan(w0 * 2);

  await page.getByRole("button", { name: /restablecer zoom/ }).click();
  expect((await strip.boundingBox())!.width).toBeCloseTo(w0, 0);
});

test("reader toolbar: starts visible, a tap hides it and another shows it; no automatic fullscreen", async ({ page }) => {
  const c = await firstPublishedChapter();
  test.skip(!c, "no published chapter with pages in the database");
  await page.goto(`/read/${c!.id}`);
  const bar = page.getByRole("toolbar", { name: "Herramientas del lector" });
  await expect(bar).toBeInViewport();
  await page.locator("[data-page]").first().click();
  await expect(bar.locator("..")).toHaveClass(/pointer-events-none/);
  await page.locator("[data-page]").first().click();
  await expect(bar.locator("..")).not.toHaveClass(/pointer-events-none/);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test("reader swipe: the strip scrolls by touch, pages mode turns the page with a sideways swipe", async ({ page }) => {
  const c = await firstPublishedChapter();
  test.skip(!c, "no published chapter with pages in the database");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/read/${c!.id}`);
  await expect(page.locator("[data-page]").first()).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const scroller = page.locator("[data-scroller]");

  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let k = 1; k <= 10; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * k / 10, y: y0 + (y1 - y0) * k / 10, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await drag(195, 600, 195, 200);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);

  await scroller.evaluate((el) => el.scrollTo(0, 0));
  await page.getByRole("button", { name: "Modo páginas" }).click();
  const counter = page.getByText(/^\d+ \/ \d+$/);
  await expect(counter).toHaveText(/^1 \//);
  const total = Number((await counter.textContent())!.split("/")[1]);
  test.skip(total < 2, "chapter has a single page");
  await drag(300, 400, 90, 410);
  await expect(counter).toHaveText(`2 / ${total}`);
  await drag(90, 400, 300, 410);
  await expect(counter).toHaveText(`1 / ${total}`);
});
