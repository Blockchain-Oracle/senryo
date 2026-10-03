"use client";

/**
 * The Home Total (flow book B16, BD-1; the sum the phone's balance sheet defines): Assets (every verified, priced
 * holding, the dollar assets' trading part counted once) + Positions (unrealised P&L at the conservative exit; their
 * margin is already inside Assets) + Earn (pool shares and pending redemptions) − card holds − card debt. It reads the
 * same sources as the Assets tab, so the hero and the rows never disagree — the portfolio snapshot pins to the
 * indexer's block and can trail a fresh claim by minutes. Partial when a verified part is unpriced or unread.
 */
import { isDeployed } from "@senryo/chain";
import type { Address } from "@senryo/core";
import { previewPosition } from "@senryo/core";
import { riskViewOf, useAccountRisk, useLpVault, useMarkets, usePositions, useQueryEnv } from "@senryo/query";
import { known } from "@/components/ui/reading";
import { useMoneyAssets } from "./use-money-assets";

export interface Total {
  status: "loading" | "ready" | "failed";
  totalUsd6: bigint;
  partial: boolean;
}

export function useTotal(address: Address | undefined): Total {
  const env = useQueryEnv();
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const money = useMoneyAssets(address);
  const risk = useAccountRisk(coreReady ? address : undefined, "latest");
  const positions = usePositions(coreReady ? address : undefined);
  const vault = useLpVault(address);
  const markets = useMarkets();
  const snapshot = known(risk);
  const held = known(positions);
  const pool = known(vault);

  let upnl = 0n;
  let unpriced = false;
  if (snapshot && held) {
    const account = riskViewOf(snapshot);
    for (const p of held) {
      const m = markets.map((row) => known(row.reading)).find((v) => v?.marketId === p.marketId);
      if (!m) {
        unpriced = true;
        continue;
      }
      upnl += previewPosition(m.risk, m.pv, account, p).upnlUsd6;
    }
  }
  const earn = pool ? pool.sharesValue + pool.pendingValue : 0n;
  const card = snapshot ? snapshot.holds + snapshot.cardDebt : 0n;
  if (money.status === "loading") return { status: "loading", totalUsd6: 0n, partial: false };
  if (money.status === "failed") return { status: "failed", totalUsd6: 0n, partial: true };
  const unread =
    (coreReady && address !== undefined && (risk.status === "failed" || positions.status === "failed")) ||
    vault.status === "failed";
  return {
    status: "ready",
    totalUsd6: money.totalUsd6 + upnl + earn - card,
    partial: money.partial || unpriced || unread,
  };
}
