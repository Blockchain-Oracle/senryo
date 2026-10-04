import type { Prediction } from "@senryo/api-client";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { ids, routeAssetId } from "@senryo/identity";

const BPS_PER_PERCENT = 100;
const MS_PER_SECOND = 1000;
const MINUTES_PER_DAY = 1440;

/** The underlying asset identity, rather than a Perpl instrument or a transferable Castora token. */
export function predictionMark(asset: string) {
  if (asset === "MON") return ids.native(MAINNET_CHAIN_ID, "MON");
  const chain = asset === "BTC" ? "bitcoin" : asset === "ETH" ? "ethereum" : asset === "SOL" ? "solana" : undefined;
  return chain ? (routeAssetId(asset, chain) ?? ids.equity(asset)) : ids.equity(asset);
}
export const percent = (bps: number | null) =>
  bps === null ? "Unavailable" : `${(bps / BPS_PER_PERCENT).toFixed(bps % BPS_PER_PERCENT === 0 ? 0 : 1)}%`;
export const time = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export function statusText(m: Prediction, now: number) {
  if (m.status === "resolved") return "Resolved";
  if (m.status === "disputed") return "Disputed";
  if (m.closesAt <= now) return m.status === "closed" ? "Closed" : "Awaiting resolution";
  if (m.status === "upcoming") return "Upcoming";
  if (m.kind === "price-contest" && m.paused) return "Paused";
  return m.status === "open" ? "Live" : "Closed";
}
export function countdown(sec: number, now: number) {
  const left = Math.max(0, sec - now);
  if (left === 0) return "Entry ended";
  const minutes = Math.ceil(left / 60);
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < MINUTES_PER_DAY) return `${Math.ceil(minutes / 60)}h left`;
  return time(sec);
}
