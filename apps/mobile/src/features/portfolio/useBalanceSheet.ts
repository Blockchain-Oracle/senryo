/**
 * One honest number and its parts (flow book B16, BD-1, BD-8): Assets (every verified, priced holding, the dollar assets'
 * trading part counted gross and once) + Positions (engine: unrealised PnL, their margin is already inside Assets;
 * Perpl, Mainnet: the account's whole equity — free AUSD plus each position's collateral and PnL at Perpl's mark —
 * because that AUSD left the wallet and nothing in Assets counts it) + Earn
 * (pool shares and pending redemptions) + Arriving (purchases and inbound bridges this phone started, where the amount
 * is known) − Card holds − Card debt. The rows sum to the total to the cent; the Home hero should read the same total
 * (`useBalanceSheet().totalUsd6`) so the sheet and the hero never disagree. Partial = a verified part is unpriced or
 * unread; unverified tokens never make it partial.
 */
import { isDeployed } from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useAccountRisk, useLpVault, usePerplAccount, usePositions, useQueryEnv } from "@senryo/query";
import { type Arrival, useArrivals } from "~/features/money/arrivals";
import { valueOfUnits } from "~/features/money/assets";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useAccount } from "~/lib/account/provider";
import { usePositionsSummary } from "./usePositionsSummary";

export type SheetRowKey = "assets" | "positions" | "earn" | "arriving" | "holds" | "debt";

export interface SheetRow {
  key: SheetRowKey;
  label: string;
  detail?: string | undefined;
  /** The row's signed part of the total (usd6); undefined when it couldn't be read or valued. */
  valueUsd6: bigint | undefined;
  /** Entity ids for the row's marks (largest first). */
  marks: string[];
}

export interface BalanceSheet {
  status: "loading" | "ready";
  totalUsd6: bigint;
  partial: boolean;
  rows: SheetRow[];
  /** Verified assets with no price (Mainnet): "Missing price: SAKURA". */
  missingPrices: string[];
  /** Some tokens aren't discovered or read yet. */
  missingTokens: boolean;
  arrivals: Arrival[];
}

const MARKS_SHOWN = 3;

export function useBalanceSheet(): BalanceSheet {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const money = useMoneyAssets();
  const risk = useAccountRisk(coreReady ? address : undefined, "finalized");
  const positions = usePositions(coreReady ? address : undefined);
  const summary = usePositionsSummary();
  const mainnet = env.chainId === MAINNET_CHAIN_ID;
  const perpl = usePerplAccount(mainnet ? address : undefined);
  const vault = useLpVault(address);
  const arrivals = useArrivals(env.chainId, address, money.status === "ready" ? money.assets : undefined);

  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const open = positions.status === "fresh" || positions.status === "stale" ? positions.value.length : undefined;
  const pool = vault.status === "fresh" || vault.status === "stale" ? vault.value : undefined;
  const rows: SheetRow[] = [];

  rows.push({
    key: "assets",
    label: "Assets",
    detail:
      money.assets.length > 0
        ? money.assets
            .map((a) => a.symbol)
            .slice(0, MARKS_SHOWN)
            .join(" · ")
        : undefined,
    valueUsd6: money.status === "ready" ? money.totalUsd6 : undefined,
    marks: money.assets.slice(0, MARKS_SHOWN).map((a) => a.mark),
  });
  // Perpl (D1): AUSD at $1, like every other dollar asset here; equity can't go below zero for the owner.
  const perplSnapshot = perpl.status === "fresh" || perpl.status === "stale" ? perpl.value : undefined;
  const perplOpen = perplSnapshot?.positions.length ?? 0;
  const perplEquity = perplSnapshot?.account
    ? perplSnapshot.positions.reduce((sum, p) => sum + p.depositCNS + p.pnlCNS, perplSnapshot.account.balanceCNS)
    : 0n;
  const engineOpen = open ?? 0;
  if (engineOpen > 0 || perplEquity > 0n) {
    const parts = [
      engineOpen + perplOpen > 0 ? `${engineOpen + perplOpen} open` : undefined,
      perplEquity > 0n ? "Perpl" : undefined,
    ].filter((p): p is string => p !== undefined);
    const engineValue = engineOpen > 0 ? summary?.upnlUsd6 : 0n;
    rows.push({
      key: "positions",
      label: "Positions",
      detail: parts.join(" · "),
      valueUsd6: engineValue === undefined ? undefined : engineValue + (perplEquity > 0n ? perplEquity : 0n),
      marks: perplEquity > 0n ? [ids.venue("perpl")] : [],
    });
  }
  if (pool && pool.sharesValue + pool.pendingValue > 0n) {
    rows.push({
      key: "earn",
      label: "Earn",
      detail: pool.pending.length > 0 ? "Redemption pending" : "Senryo pool",
      valueUsd6: pool.sharesValue + pool.pendingValue,
      marks: [],
    });
  }
  if (arrivals.length > 0) {
    let known = 0n;
    for (const a of arrivals) {
      const asset = money.find(a.asset);
      if (a.amount && asset?.priceUsd18) known += valueOfUnits(BigInt(a.amount), asset.decimals, asset.priceUsd18);
    }
    rows.push({
      key: "arriving",
      label: "Arriving",
      detail: arrivals.map((a) => `${a.symbol} · ${a.via}`).join(", "),
      valueUsd6: known,
      marks: arrivals.slice(0, MARKS_SHOWN).map((a) => money.find(a.asset)?.mark ?? ""),
    });
  }
  if (snapshot && snapshot.holds > 0n) {
    rows.push({
      key: "holds",
      label: "Card holds",
      detail: "Waiting to settle",
      valueUsd6: -snapshot.holds,
      marks: [],
    });
  }
  if (snapshot && snapshot.cardDebt > 0n) {
    rows.push({ key: "debt", label: "Card debt", valueUsd6: -snapshot.cardDebt, marks: [] });
  }

  const missingPrices =
    env.chainId === MAINNET_CHAIN_ID
      ? money.assets.filter((a) => a.valueUsd6 === null && a.total > 0n).map((a) => a.symbol)
      : [];
  const missingTokens = money.degraded || (money.partial && missingPrices.length === 0);
  const unreadPositions =
    (open !== undefined && open > 0 && summary === undefined) ||
    (mainnet && address !== undefined && perpl.status === "failed");
  const unreadCore = coreReady && address !== undefined && risk.status === "failed";
  const totalUsd6 = rows.reduce((sum, r) => sum + (r.valueUsd6 ?? 0n), 0n);
  return {
    status: money.status === "loading" ? "loading" : "ready",
    totalUsd6,
    partial: money.partial || unreadPositions || unreadCore || vault.status === "failed",
    rows,
    missingPrices,
    missingTokens,
    arrivals,
  };
}
