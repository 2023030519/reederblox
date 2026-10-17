// Hard refresh: drop the service worker and its caches so the newest build loads; downloads (IndexedDB) stay.
// Offline it is a plain reload, so the cached app shell still opens.
export async function hardRefresh() {
  if (navigator.onLine) {
    try {
      await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
    } catch { /* no caches or service worker here: a reload is still a reload */ }
  }
  location.reload();
}

// The build this code came from (see next.config.ts); /version answers with the build the server runs now.
export const VERSION = process.env.NEXT_PUBLIC_VERSION ?? "dev";

export async function hasUpdate() {
  const res = await fetch("/version", { cache: "no-store" }).catch(() => null);
  return !!res?.ok && (await res.text()).trim() !== VERSION;
}
