/**
 * The at-a-glance summary behind the BottomAccessory mini-bar ("2 POS · +$115.80 · XAU LIQ 12% AWAY"): open positions
 * on the latest snapshot, total unrealised PnL at the conservative exit, and the position closest to liquidation —
 * each priced by its market's live view through the core preview. Undefined while there is nothing to show.
 */
import { previewPosition } from "@senryo/core";
import { riskViewOf, useAccountRisk, useMarkets, usePositions } from "@senryo/query";
import { useAccount } from "~/lib/account/provider";

export interface PositionsSummary {
  count: number;
  upnlUsd6: bigint;
  nearest: { symbol: string; distanceBps: bigint } | undefined;
}

export function usePositionsSummary(): PositionsSummary | undefined {
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const markets = useMarkets();
  if (risk.status !== "fresh" && risk.status !== "stale") return undefined;
  if (positions.status !== "fresh" && positions.status !== "stale") return undefined;
  if (positions.value.length === 0) return undefined;
  const account = riskViewOf(risk.value);
  let upnl = 0n;
  let nearest: PositionsSummary["nearest"];
  for (const p of positions.value) {
    const row = markets.find(
      (m) => m.reading.status !== "unknown" && m.reading.status !== "failed" && m.reading.value.marketId === p.marketId,
    );
    if (!row || (row.reading.status !== "fresh" && row.reading.status !== "stale")) continue;
    const m = row.reading.value;
    const health = previewPosition(m.risk, m.pv, account, p);
    upnl += health.upnlUsd6;
    const away = health.liqDistanceBps;
    if (away !== null && (nearest === undefined || away < nearest.distanceBps))
      nearest = { symbol: m.symbol, distanceBps: away };
  }
  return { count: positions.value.length, upnlUsd6: upnl, nearest };
}
