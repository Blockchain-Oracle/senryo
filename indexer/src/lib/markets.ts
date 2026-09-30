/** Market rows for both venues and the trade aggregates every fill feeds. */
import type { Market } from "envio";
import { OUR_MARKETS, OURS_PREFIX, PERPL_PREFIX, WAD_DECIMALS } from "./constants.ts";
import type { Ctx, Meta } from "./meta.ts";
import { updateMarketDaily, updateProtocol, updateProtocolDaily, updateUserDaily } from "./stats.ts";
import { updateUser } from "./users.ts";

export const ourMarketId = (marketIndex: number) => `${OURS_PREFIX}-${marketIndex}`;
export const perplMarketId = (perpId: bigint) => `${PERPL_PREFIX}-${perpId}`;

type MarketSeed = Pick<Market, "id" | "venue" | "marketIndex" | "symbol" | "name" | "priceDecimals" | "lotDecimals">;

function emptyMarket(seed: MarketSeed): Market {
  return {
    ...seed,
    enabled: true,
    status: "OPEN",
    statusSince: undefined,
    lastPrice: undefined,
    lastPriceAt: undefined,
    longSize: 0n,
    shortSize: 0n,
    fundingIndex: 0n,
    borrowIndex: 0n,
    fundingRate: 0n,
    borrowRate: 0n,
    volume: 0n,
    tradeCount: 0,
    appVolume: 0n,
    appTradeCount: 0,
    feed_id: undefined,
  };
}

/** Our gold/silver markets: symbol from SeedConstants, linked to the asset's oracle feed. */
export async function loadOurMarket(ctx: Ctx, marketIndex: number): Promise<Market> {
  const id = ourMarketId(marketIndex);
  const existing = await ctx.Market.get(id);
  if (existing) return existing;
  const known = OUR_MARKETS[marketIndex];
  const symbol = known?.symbol ?? `M${marketIndex}`;
  return {
    ...emptyMarket({
      id,
      venue: "OURS",
      marketIndex: BigInt(marketIndex),
      symbol,
      name: known?.name ?? symbol,
      priceDecimals: WAD_DECIMALS,
      lotDecimals: WAD_DECIMALS,
    }),
    feed_id: known ? symbol : undefined,
  };
}

/** Perpl markets are created from ContractAdded(V2); later events keep their live stats. */
export function newPerplMarket(seed: Omit<MarketSeed, "venue">): Market {
  return emptyMarket({ ...seed, venue: "PERPL" });
}

export interface TradeStats {
  userId: string;
  marketId: string;
  venue: Market["venue"];
  /** usd6 */
  notional: bigint;
  fee: bigint;
  realizedPnl: bigint;
  funding: bigint;
  borrow: bigint;
  /** +1 opened a position, −1 closed one, 0 otherwise */
  openDelta: number;
  liquidation: boolean;
}

/** User, daily, market-daily and protocol aggregates for one app-user fill. Market totals are the caller's. */
export async function recordTradeStats(ctx: Ctx, meta: Meta, t: TradeStats): Promise<void> {
  const before = await ctx.User.get(t.userId);
  const firstTrade = !before || before.firstTradeAt === undefined;
  await updateUser(ctx, meta, t.userId, (u) => ({
    volume: u.volume + t.notional,
    tradeCount: u.tradeCount + 1,
    feesPaid: u.feesPaid + t.fee,
    realizedPnl: u.realizedPnl + t.realizedPnl,
    fundingPaid: u.fundingPaid + t.funding,
    borrowPaid: u.borrowPaid + t.borrow,
    openPositions: Math.max(0, u.openPositions + t.openDelta),
    liquidationCount: u.liquidationCount + (t.liquidation ? 1 : 0),
    firstTradeAt: u.firstTradeAt ?? meta.timestamp,
  }));
  await updateUserDaily(ctx, meta, t.userId, (d) => ({
    realizedPnl: d.realizedPnl + t.realizedPnl,
    fees: d.fees + t.fee,
    funding: d.funding + t.funding + t.borrow,
    volume: d.volume + t.notional,
    trades: d.trades + 1,
  }));
  await updateMarketDaily(ctx, meta, t.marketId, (d) => ({
    appVolume: d.appVolume + t.notional,
    fees: d.fees + t.fee,
    liquidations: d.liquidations + (t.liquidation ? 1 : 0),
  }));
  const ours = t.venue === "OURS";
  await updateProtocol(ctx, meta, (s) => ({
    traders: s.traders + (firstTrade ? 1 : 0),
    volumeOurs: s.volumeOurs + (ours ? t.notional : 0n),
    volumePerplApp: s.volumePerplApp + (ours ? 0n : t.notional),
    trades: s.trades + 1,
    fees: s.fees + t.fee,
  }));
  await updateProtocolDaily(ctx, meta, (d) => ({
    volume: d.volume + t.notional,
    trades: d.trades + 1,
    fees: d.fees + t.fee,
  }));
}

/** A fee that arrives after its fill (Perpl maker/taker fee events). */
export async function recordLateFee(ctx: Ctx, meta: Meta, userId: string, marketId: string, fee: bigint) {
  if (fee === 0n) return;
  await updateUser(ctx, meta, userId, (u) => ({ feesPaid: u.feesPaid + fee }));
  await updateUserDaily(ctx, meta, userId, (d) => ({ fees: d.fees + fee }));
  await updateMarketDaily(ctx, meta, marketId, (d) => ({ fees: d.fees + fee }));
  await updateProtocol(ctx, meta, (s) => ({ fees: s.fees + fee }));
  await updateProtocolDaily(ctx, meta, (d) => ({ fees: d.fees + fee }));
}
