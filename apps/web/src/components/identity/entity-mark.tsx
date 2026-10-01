"use client";

import { type EntityMarkProps, EntityMark as Mark, webIdentityTheme } from "@senryo/identity/web";
import { useTheme } from "next-themes";

/**
 * The web EntityMark: `@senryo/identity`'s mark with the app's CSS-variable theme. The scheme only picks mono variants
 * and contrast plates; it defaults to dark until next-themes resolves (static export).
 */
export function EntityMark(props: Omit<EntityMarkProps, "theme">) {
  const { resolvedTheme } = useTheme();
  return <Mark {...props} theme={webIdentityTheme(resolvedTheme === "light" ? "light" : "dark")} />;
}
