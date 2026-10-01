import { EntityGlyph, ids } from "@senryo/identity/native";
import { SIZE, useTheme } from "~/theme";

export const PASSKEY = ids.provider("passkey");

/**
 * The passkey glyph on every passkey surface (create, sign-in, step-up, recovery, security): Material Symbols
 * "passkey" (packages/identity/src/art/auth.ts) presented per FIDO's Passkey Icon Usage Guidelines — one flat colour
 * matching the label beside it, never below 24 px, hidden from screen readers because the label names the action.
 */
export function PasskeyGlyph({ color, size = SIZE.icon }: { color?: string; size?: number }) {
  const theme = useTheme();
  return <EntityGlyph id={PASSKEY} size={size} color={color ?? theme.color.ink} />;
}
