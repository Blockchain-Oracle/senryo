/** Aggregation state for pool-analytics.ts (all money usd6 bigint, prices in the perp's PNS units). */

export interface PerpMeta {
  symbol: string;
  priceDecimals: number;
  lotDecimals: number;
}

export interface PerpStats {
  volume: bigint;
  fills: number;
  fees: bigint;
  liquidations: number;
  liquidatedNotional: bigint;
  liqPrices: Array<{ price: bigint; notional: bigint }>;
  fundingEvents: number;
  fundingAbsRateSum: bigint;
}

export interface Aggregates {
  perps: Map<string, PerpStats>;
  pnlByAccount: Map<string, bigint>;
  perPerp(id: string): PerpStats;
  addPnl(accountId: string, pnl: bigint): void;
}

export function emptyAggregates(): Aggregates {
  const perps = new Map<string, PerpStats>();
  const pnlByAccount = new Map<string, bigint>();
  return {
    perps,
    pnlByAccount,
    perPerp(id) {
      let stats = perps.get(id);
      if (!stats) {
        stats = {
          volume: 0n,
          fills: 0,
          fees: 0n,
          liquidations: 0,
          liquidatedNotional: 0n,
          liqPrices: [],
          fundingEvents: 0,
          fundingAbsRateSum: 0n,
        };
        perps.set(id, stats);
      }
      return stats;
    },
    addPnl(accountId, pnl) {
      pnlByAccount.set(accountId, (pnlByAccount.get(accountId) ?? 0n) + pnl);
    },
  };
}
