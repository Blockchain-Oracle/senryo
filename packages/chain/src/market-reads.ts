import type { ChainId } from "@senryo/config";
import { marketCalendarAbi, senryoCoreAbi, sessionOracleAbi } from "@senryo/contracts/abis";
import type { MarketBook, MarketRisk, PriceView, WeekCalendar } from "@senryo/core";
import { MARKET_STATUSES, RISK } from "@senryo/core";
import type { ReadClient } from "./clients.ts";
import { addressOf } from "./contracts.ts";
import type { ReadTag } from "./reads.ts";

/** `Book.POOL` in `Types.sol` — the LP pool's ledger entry inside SenryoCore. */
const POOL_BOOK = 0;

/** Everything the ticket preview needs for one market, from one block (S8.7): params, book, oracle, calendar id. */
export interface MarketRiskSnapshot {
  marketId: number;
  enabled: boolean;
  risk: MarketRisk;
  book: MarketBook;
  pv: PriceView;
  updatedAt: bigint;
  calendarId: number;
  maxLeverageX: number;
  /** Accrual indexes (1e18) as of the market's last accrual — funding/borrow owed ≈ Δ × entry notional (F11). */
  fundingIndex: bigint;
  borrowIndex: bigint;
}

export async function readMarketRisk(
  read: ReadClient,
  chainId: ChainId,
  marketId: number,
  at: ReadTag | bigint = "latest",
): Promise<MarketRiskSnapshot> {
  const core = { address: addressOf(chainId, "SenryoCore"), abi: senryoCoreAbi } as const;
  const oracle = { address: addressOf(chainId, "SessionOracle"), abi: sessionOracleAbi } as const;
  const [params, state, pool, peek, feed] = await read.multicall({
    contracts: [
      { ...core, functionName: "marketParams", args: [marketId] },
      { ...core, functionName: "marketState", args: [marketId] },
      { ...core, functionName: "book", args: [POOL_BOOK] },
      { ...oracle, functionName: "peek", args: [marketId] },
      { ...oracle, functionName: "feeds", args: [marketId] },
    ],
    allowFailure: false,
    ...(typeof at === "bigint" ? { blockNumber: at } : { blockTag: at }),
  });
  const [poolAusd, poolUsdc] = pool;
  const imBps = BigInt(params.imBps);
  return {
    marketId,
    enabled: params.enabled,
    risk: {
      imBps,
      mmBps: BigInt(params.mmBps),
      feeBps: BigInt(params.feeBps),
      baseSpreadBps: BigInt(params.baseSpreadBps),
      devSpreadBps: BigInt(params.devSpreadBps),
      maxProfitBps: BigInt(params.maxProfitBps),
      tradeCapPoolBps: BigInt(params.tradeCapPoolBps),
      oiCapAbsUsd6: params.oiCapAbsUsd6,
      oiCapPoolBps: BigInt(params.oiCapPoolBps),
      skewCapPoolBps: BigInt(params.skewCapPoolBps),
    },
    book: { longSize: state.longSize, shortSize: state.shortSize, poolUsd6: poolAusd + poolUsdc },
    pv: {
      price18: peek.price18,
      latest18: peek.latest18,
      status: MARKET_STATUSES[peek.status] ?? "HALTED",
      spreadBps: BigInt(peek.spreadBps),
    },
    updatedAt: BigInt(peek.updatedAt),
    calendarId: feed[1],
    fundingIndex: BigInt(state.fundingIndex),
    borrowIndex: BigInt(state.borrowIndex),
    maxLeverageX: imBps > 0n ? Number(RISK.BPS / imBps) : 0,
  };
}

/** `MarketCalendar.week` + `holidays` for the session copy ("opens Sun 23:00 UTC"); display only. */
export async function readCalendar(read: ReadClient, chainId: ChainId, calendarId: number): Promise<WeekCalendar> {
  const calendar = { address: addressOf(chainId, "MarketCalendar"), abi: marketCalendarAbi } as const;
  const [week, holidays] = await read.multicall({
    contracts: [
      { ...calendar, functionName: "week", args: [calendarId] },
      { ...calendar, functionName: "holidays", args: [calendarId] },
    ],
    allowFailure: false,
  });
  return {
    week: [week[0] ?? 0n, week[1] ?? 0n, week[2] ?? 0n],
    holidays: holidays.map((h) => ({ start: BigInt(h.start), end: BigInt(h.end) })),
  };
}
