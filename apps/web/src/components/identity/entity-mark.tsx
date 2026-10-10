"use client";

import { type EntityMarkProps, EntityMark as Mark, webIdentityTheme } from "@senryo/identity/web";
import { useTheme } from "next-themes";

/**
 * The web EntityMark: `@senryo/identity`'s mark with the app's CSS-variable theme. The scheme only picks mono variants
 * and contrast plates; it is light until next-themes resolves (static export; light is the default, D-304). `ground` is
 * the surface it sits on (for the badge cut-out), as on the phone; it defaults to the panel colour.
 */
export function EntityMark({ ground, ...props }: Omit<EntityMarkProps, "theme"> & { ground?: string }) {
  const { resolvedTheme } = useTheme();
  return <Mark {...props} theme={webIdentityTheme(resolvedTheme === "dark" ? "dark" : "light", ground)} />;
}
