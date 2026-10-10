import { LIGHT } from "@senryo/tokens";
import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/constants/brand";

/** Generated once at build (static export). */
export const dynamic = "force-static";

/**
 * The web app's manifest (R2.17): installable from the browser, opening on the app (not the landing) full screen, on the
 * light ground (D-304). Icons are the app icon at the sizes browsers install with (`brand/scripts/render.sh`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.title,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/app/",
    scope: "/",
    display: "standalone",
    background_color: LIGHT.background,
    theme_color: LIGHT.background,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
