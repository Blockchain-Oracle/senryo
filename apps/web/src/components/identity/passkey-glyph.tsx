import { EntityGlyph, ids } from "@senryo/identity/web";

export const PASSKEY = ids.provider("passkey");
/** FIDO's Passkey Icon Usage Guidelines: never below 24 × 24 (also EntityGlyph's floor from the file's `minPx`). */
const PASSKEY_EDGE = 24;
/** Inside an auth card's glyph tile, matching the tile's `[&_svg]:size-7`. */
export const PASSKEY_TILE_EDGE = 28;

/**
 * The passkey glyph on every passkey surface (create, sign-in, step-up, recovery, security): Material Symbols
 * "passkey" (packages/identity/src/art/auth.ts) presented per FIDO's guidelines — one flat colour (the surrounding text
 * colour), ≥ 24 px, aria-hidden because the visible label names the action.
 */
export function PasskeyGlyph({ size = PASSKEY_EDGE, className }: { size?: number; className?: string }) {
  return <EntityGlyph id={PASSKEY} size={size} {...(className ? { className } : {})} />;
}
