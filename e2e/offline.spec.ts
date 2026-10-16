import { test, expect } from "@playwright/test";
import { firstPublishedChapter } from "./data";

// Uses whichever published chapter with pages exists in the database.
test("download a chapter, go offline, read it from the saved copy", async ({ page, context }) => {
  test.setTimeout(150000);
  const c = await firstPublishedChapter();
  test.skip(!c, "no published chapter with pages in the database");
  // Let the service worker install and take control before anything else.
  await page.goto("/offline");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText("No tienes capítulos descargados")).toBeVisible();

  await page.goto(`/read/${c!.id}`);
  await expect(page.locator("img[alt^='Página']").first()).toBeVisible();
  const readerUrl = page.url();

  await page.getByRole("button", { name: /Descargar este capítulo/ }).click();
  await expect(page.getByRole("button", { name: /Quitar la descarga/ })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Capítulo guardado para leer sin conexión")).toBeVisible();

  // Visit the page once more with the worker in control so its HTML is cached, then cut the network.
  await page.goto(readerUrl);
  await expect(page.locator("img[alt^='Página']").first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("Leyendo la copia descargada")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("img[alt^='Página']").first()).toBeVisible();
  await expect(page.locator("img[alt^='Página']").first()).toHaveJSProperty("complete", true);
  await expect(page.getByText("Sin conexión.")).toBeVisible();

  // The downloads page works offline too and lists the chapter.
  await page.getByRole("link", { name: "Ir a Descargas" }).click();
  await expect(page.getByRole("heading", { name: "Descargas" })).toBeVisible();
  await expect(page.getByText(/Capítulo \d+ · \d+ páginas/)).toBeVisible();

  // Clean up: remove the download (back online).
  await context.setOffline(false);
  await page.getByRole("button", { name: "Quitar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByText("No tienes capítulos descargados")).toBeVisible();
});

test("an unsaved chapter offline explains what to do", async ({ page, context }) => {
  await page.goto("/offline");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto("/read/00000000-0000-0000-0000-000000000000");
  // Unknown page offline: the worker serves the downloads page as the fallback.
  await expect(page.getByRole("heading", { name: "Descargas" })).toBeVisible({ timeout: 15000 });
});
