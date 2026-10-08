/**
 * The risk explainer gate (F10, D-023; flow book C3/C3a): before a person's first trade, and again before their first
 * short, on EACH network — accepting in Practice never counts for real money. The slide that asked continues by itself
 * once the explainer is accepted (no second slide); "Not now" drops it. The cards name the venue's own rules.
 */
import { type Href, router } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";
import type { NetworkKey } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import type { Side } from "./draft";

export type RiskVenue = "engine" | "perpl";

/** v1 keys were global; they were only ever accepted before Practice trades, so they carry to Practice alone. */
const LEGACY = { general: "senryo.risk-explained.v1", short: "senryo.short-risk-explained.v1" } as const;

const keyOf = (base: string, network: NetworkKey) => `${base}:${network}`;

function accepted(base: string, legacy: string, network: NetworkKey): boolean {
  const own = storage.getBoolean(keyOf(base, network));
  if (own !== undefined) return own;
  return network === "testnet" && (storage.getBoolean(legacy) ?? false);
}

export function generalRiskAccepted(network: NetworkKey): boolean {
  return accepted(STORAGE_KEYS.riskExplained, LEGACY.general, network);
}

export function riskAccepted(network: NetworkKey, side: Side): boolean {
  return (
    generalRiskAccepted(network) &&
    (side === "long" || accepted(STORAGE_KEYS.shortRiskExplained, LEGACY.short, network))
  );
}

export function acceptRisk(network: NetworkKey, short: boolean): void {
  storage.set(keyOf(STORAGE_KEYS.riskExplained, network), true);
  if (short) storage.set(keyOf(STORAGE_KEYS.shortRiskExplained, network), true);
}

let pending: (() => void) | undefined;

/** Run `proceed` now if this network's risk for `side` was accepted; otherwise after the explainer is accepted. */
export function requireRisk(network: NetworkKey, side: Side, venue: RiskVenue, proceed: () => void): void {
  if (riskAccepted(network, side)) {
    proceed();
    return;
  }
  pending = proceed;
  router.push(`${ROUTES.riskExplainer}?side=${side}&venue=${venue}&network=${network}` as Href);
}

/** The explainer's accept hands back the waiting slide (once); dismissing drops it. */
export function takePendingRisk(): (() => void) | undefined {
  const next = pending;
  pending = undefined;
  return next;
}
