"use client";
/**
 * "New version available" (R2.17; Owarine's `useAppUpdate`, Tradash's PWA updater): the build this page loaded from
 * (`NEXT_PUBLIC_BUILD_ID`, `scripts/build-id.mjs`) against the server's `/version.json`, every five minutes and when the
 * tab comes back; once they differ, one persistent toast with Refresh. Off under `next dev` (no build id).
 */
import { useEffect } from "react";
import { notify } from "@/lib/notify";

const CHECK_MS = 300_000;
const RUNNING = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

export function useAppUpdate(): void {
  useEffect(() => {
    if (!RUNNING) return;
    let shown = false;
    const check = async () => {
      if (shown || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        const { build } = (await res.json()) as { build?: string };
        if (!build || build === RUNNING) return;
        shown = true;
        notify({
          id: "app-update",
          persistent: true,
          title: "New version available",
          description: "Refresh to get the latest Senryo.",
          action: { label: "Refresh", onClick: () => window.location.reload() },
        });
      } catch {
        // Offline or mid-deploy: the next check asks again.
      }
    };
    const timer = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
}
