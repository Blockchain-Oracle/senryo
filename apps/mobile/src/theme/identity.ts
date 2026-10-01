import type { IdentityTheme } from "@senryo/identity";
import { DARK as DARK_TOKENS, LIGHT as LIGHT_TOKENS } from "@senryo/tokens";
import type { Palette } from "./palette";
import { FONT } from "./type";

/**
 * The colours `@senryo/identity`'s EntityMark takes from the app (it never imports this theme): a neutral plate for
 * uncontained marks, fixed light/dark plates for marks whose contrast needs them, the ground for badge cut-outs, and
 * the neutral fallback's ink. `ground` defaults to the panel surface marks usually sit on.
 */
export function identityTheme(color: Palette, scheme: "dark" | "light", ground?: string): IdentityTheme {
  return {
    scheme,
    plate: color.secondary,
    rim: color.hairline,
    plateLight: LIGHT_TOKENS.card,
    plateDark: DARK_TOKENS.card,
    ground: ground ?? color.card,
    skeleton: color.muted,
    fallbackInk: color.inkMuted,
    fontFamily: FONT.sansStrong,
  };
}
