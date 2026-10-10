import { basketMembers, type MarketSpec } from "./catalog.ts";

/**
 * Whether a market has a price source at all (D-310, 04-pricing F3/R11). RedStone's keyless public gateways stop
 * answering on 29 Oct 2026. Without the api's own key (`REDSTONE_GATEWAYS`), every RedStone market — and a basket with
 * a RedStone member — is read-only discovery from then: listed, with the reason, no calls. Setting the key brings them
 * back on the api's next start; nothing else changes.
 */
const MS_PER_SECOND = 1_000;
export const REDSTONE_KEYLESS_END_SEC = Date.parse("2026-10-29T00:00:00Z") / MS_PER_SECOND;

/** What the apps show on a paused market's row and panel. */
export const MARKET_PAUSED_TEXT = "Paused · price feed offline";

function onRedStone(m: MarketSpec): boolean {
  return m.source.kind === "redstone" || basketMembers(m).some(({ market }) => market.source.kind === "redstone");
}

/** Why a market can't take calls at all — no price source, unlike a session that opens on its own — or null. */
export function pauseOf(m: MarketSpec, nowSec: number, redstoneKeyed: boolean): string | null {
  if (redstoneKeyed || nowSec < REDSTONE_KEYLESS_END_SEC) return null;
  return onRedStone(m) ? MARKET_PAUSED_TEXT : null;
}
