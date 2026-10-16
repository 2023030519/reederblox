"use client";
import { useEffect } from "react";

// Production only: in dev a cache-first service worker would serve stale chunks and fight hot reload.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
