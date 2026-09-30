/**
 * Ticket and position previews from the risk-math mirror (preview only — the contract re-checks everything and wins).
 * Inputs are what the app already reads: `accountRisk` + `position` (SenryoCore), `peek` (SessionOracle), market params
 * and the market book. Funding/borrow that accrue after the preview are not projected (stated in the UI).
 */
import { RISK } from "./constants.ts";
import {
  averageEntry,
  bpsDown,
  bpsUp,
  entryPrice,
  exitPrice,
  impactBps,
  maxBig,
  minBig,
  mulDiv,
  notional,
  type PriceView,
  pnl,
  type SpreadParams,
  sizeFor,
} from "./math.ts";

const { BPS, NOTIONAL_SCALE } = RISK;

export interface MarketRisk extends SpreadParams {
  imBps: bigint;
  mmBps: bigint;
  feeBps: bigint;
  maxProfitBps: bigint;
  tradeCapPoolBps: bigint;
  oiCapAbsUsd6: bigint;
  oiCapPoolBps: bigint;
  skewCapPoolBps: bigint;
}

/** Aggregate sizes of the market (1e18 units) and the LP pool cash (usd6). */
export interface MarketBook {
  longSize: bigint;
  shortSize: bigint;
  poolUsd6: bigint;
}

/** The slice of `accountRisk` the previews need; `atRisk` = any position, hold, envelope or card debt. */
export interface AccountRiskView {
  equityLiq: bigint;
  mm: bigint;
  freeToTrade: bigint;
  atRisk: boolean;
}

export interface OpenPosition {
  size: bigint;
  entry: bigint;
  isLong: boolean;
  openedBlock: bigint;
}

export interface IncreaseInput {
  market: MarketRisk;
  book: MarketBook;
  pv: PriceView;
  account: AccountRiskView;
  /** The account's current position in this market, if any. */
  position?: OpenPosition | undefined;
  isLong: boolean;
  notionalUsd6: bigint;
}

export type IncreaseIssue =
  | { kind: "NOT_OPEN" }
  | { kind: "SIDE_MISMATCH" }
  | { kind: "IMPACT_TOO_HIGH"; impactBps: bigint }
  | { kind: "MARKET_FULL"; maxNotionalUsd6: bigint }
  | { kind: "BELOW_MIN"; minUsd6: bigint }
  | { kind: "INSUFFICIENT_FREE"; shortUsd6: bigint };

export interface IncreasePreview {
  execPrice18: bigint;
  sizeDelta: bigint;
  feeUsd6: bigint;
  impactBps: bigint;
  /** Initial margin this trade adds (usd6). */
  marginUsd6: bigint;
  freeToTradeAfter: bigint;
  sizeAfter: bigint;
  entryAfter18: bigint;
  /** Oracle price at which the account becomes liquidatable, others held fixed; null = none above zero. */
  liqPrice18: bigint | null;
  /** Signed distance from the oracle price to `liqPrice18` (negative = liquidatable now). */
  liqDistanceBps: bigint | null;
  /** Maintenance margin ÷ liquidation equity after the trade, in bps (10 000 = liquidation). */
  marginUsageBps: bigint;
  issues: IncreaseIssue[];
}

/** Largest notional the market's caps allow on this side right now (trade, OI and skew caps). */
export function capHeadroomUsd6(market: MarketRisk, book: MarketBook, pv: PriceView, isLong: boolean): bigint {
  const tradeCap = bpsDown(book.poolUsd6, market.tradeCapPoolBps);
  const oiCap = minBig(market.oiCapAbsUsd6, bpsDown(book.poolUsd6, market.oiCapPoolBps));
  const sideOi = notional(isLong ? book.longSize : book.shortSize, pv.price18);
  const skew = notional(book.longSize, pv.price18) - notional(book.shortSize, pv.price18);
  const skewCap = bpsDown(book.poolUsd6, market.skewCapPoolBps);
  const skewRoom = isLong ? skewCap - skew : skewCap + skew;
  return maxBig(0n, minBig(tradeCap, minBig(oiCap - sideOi, skewRoom)));
}

function liquidation(
  isLong: boolean,
  size: bigint,
  entry18: bigint,
  equityOther: bigint,
  mmOther: bigint,
  exitSpreadBps: bigint,
  mmBps: bigint,
  price18: bigint,
): { liqPrice18: bigint | null; liqDistanceBps: bigint | null } {
  if (size === 0n) return { liqPrice18: null, liqDistanceBps: null };
  if (isLong) {
    const denom = size * (BPS - exitSpreadBps - mmBps);
    const num = ((mmOther - equityOther) * NOTIONAL_SCALE + size * entry18) * BPS;
    if (denom <= 0n || num <= 0n) return { liqPrice18: null, liqDistanceBps: null };
    const liq = mulDiv(num, 1n, denom, true);
    return { liqPrice18: liq, liqDistanceBps: ((price18 - liq) * BPS) / price18 };
  }
  const num = ((equityOther - mmOther) * NOTIONAL_SCALE + size * entry18) * BPS;
  const liq = num <= 0n ? 0n : num / (size * (BPS + exitSpreadBps + mmBps));
  return { liqPrice18: liq, liqDistanceBps: ((liq - price18) * BPS) / price18 };
}

export function previewIncrease(input: IncreaseInput): IncreasePreview {
  const { market, book, pv, account, position, isLong, notionalUsd6 } = input;
  const issues: IncreaseIssue[] = [];
  if (pv.status !== "OPEN") issues.push({ kind: "NOT_OPEN" });
  const held = position && position.size > 0n ? position : undefined;
  if (held && held.isLong !== isLong) issues.push({ kind: "SIDE_MISMATCH" });

  const skewBefore = notional(book.longSize, pv.price18) - notional(book.shortSize, pv.price18);
  const skewAfter = isLong ? skewBefore + notionalUsd6 : skewBefore - notionalUsd6;
  const impact = impactBps(skewBefore, skewAfter, book.poolUsd6) ?? RISK.MAX_IMPACT_BPS + 1n;
  if (impact > RISK.MAX_IMPACT_BPS) issues.push({ kind: "IMPACT_TOO_HIGH", impactBps: impact });
  const headroom = capHeadroomUsd6(market, book, pv, isLong);
  if (notionalUsd6 > headroom) issues.push({ kind: "MARKET_FULL", maxNotionalUsd6: headroom });

  const exec = entryPrice(market, pv, impact, isLong);
  const sizeDelta = sizeFor(notionalUsd6, exec);
  const size0 = held?.size ?? 0n;
  const entry0 = held?.entry ?? 0n;
  const sizeAfter = size0 + sizeDelta;
  const entryAfter = sizeAfter === 0n ? 0n : averageEntry(size0, entry0, sizeDelta, exec, isLong);
  if (notional(sizeAfter, entryAfter) < RISK.MIN_POSITION_NOTIONAL_USD6) {
    issues.push({ kind: "BELOW_MIN", minUsd6: RISK.MIN_POSITION_NOTIONAL_USD6 });
  }

  const fee = bpsUp(notionalUsd6, market.feeBps);
  const exit = exitPrice(market, pv, isLong);
  const uBefore = held ? pnl(isLong, size0, entry0, exit) : 0n;
  const uAfter = pnl(isLong, sizeAfter, entryAfter, exit);
  const imBefore = bpsUp(notional(size0, pv.price18), market.imBps);
  const imAfter = bpsUp(notional(sizeAfter, pv.price18), market.imBps);
  const buffer = account.atRisk ? 0n : RISK.SAFETY_BUFFER_USD6;
  const freeToTradeAfter =
    account.freeToTrade - fee - (imAfter - imBefore) + (minBig(uAfter, 0n) - minBig(uBefore, 0n)) - buffer;
  if (freeToTradeAfter < 0n) issues.push({ kind: "INSUFFICIENT_FREE", shortUsd6: -freeToTradeAfter });

  const mmThisBefore = bpsUp(notional(size0, pv.price18), market.mmBps);
  const equityOther = account.equityLiq - uBefore - fee;
  const mmOther = account.mm - mmThisBefore;
  const exitSpread = maxBig(market.baseSpreadBps, market.devSpreadBps) + pv.spreadBps;
  const liq = liquidation(isLong, sizeAfter, entryAfter, equityOther, mmOther, exitSpread, market.mmBps, pv.price18);
  const mmAfter = mmOther + bpsUp(notional(sizeAfter, pv.price18), market.mmBps);
  const equityAfter = equityOther + uAfter;
  const marginUsageBps = equityAfter <= 0n ? BPS : minBig(BPS, mulDiv(mmAfter, BPS, equityAfter, true));

  return {
    execPrice18: exec,
    sizeDelta,
    feeUsd6: fee,
    impactBps: impact,
    marginUsd6: imAfter - imBefore,
    freeToTradeAfter,
    sizeAfter,
    entryAfter18: entryAfter,
    ...liq,
    marginUsageBps,
    issues,
  };
}

const SEARCH_STEPS = 64;
/**
 * MAX leaves this much Free to trade unused (1¢): borrow is ceil-rounded per elapsed second, so between the preview and
 * inclusion the account always owes a few micro-dollars more — a MAX to the last unit would revert (S8.7 check).
 */
export const MAX_RESERVE_USD6 = 10_000n;

/**
 * The largest notional (usd6) this account can open on this side now — Free to trade (minus `reserveUsd6`), caps and
 * impact all respected; 0 when not even the minimum position fits. Binary search over `previewIncrease` (monotone).
 */
export function maxIncreaseNotional(
  input: Omit<IncreaseInput, "notionalUsd6">,
  reserveUsd6: bigint = MAX_RESERVE_USD6,
): bigint {
  const fits = (n: bigint) => {
    const p = previewIncrease({ ...input, notionalUsd6: n });
    return p.freeToTradeAfter >= reserveUsd6 && p.issues.every((i) => i.kind === "BELOW_MIN");
  };
  const imBps = input.market.imBps > 0n ? input.market.imBps : 1n;
  let hi = minBig(
    capHeadroomUsd6(input.market, input.book, input.pv, input.isLong),
    mulDiv(maxBig(input.account.freeToTrade, 0n), BPS, imBps),
  );
  let lo = 0n;
  if (hi > 0n && fits(hi)) lo = hi;
  for (let step = 0; step < SEARCH_STEPS && hi - lo > 1n; step += 1) {
    const mid = (lo + hi) / 2n;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo >= RISK.MIN_POSITION_NOTIONAL_USD6 ? lo : 0n;
}

export interface PositionHealth {
  /** Unrealised PnL at the conservative exit (usd6, signed). */
  upnlUsd6: bigint;
  liqPrice18: bigint | null;
  liqDistanceBps: bigint | null;
  marginUsageBps: bigint;
}

/** Health of a held position (position card, liquidation banner F12): the account's other positions held fixed. */
export function previewPosition(
  market: MarketRisk,
  pv: PriceView,
  account: AccountRiskView,
  position: OpenPosition,
): PositionHealth {
  const exit = exitPrice(market, pv, position.isLong);
  const upnl = pnl(position.isLong, position.size, position.entry, exit);
  const mmThis = bpsUp(notional(position.size, pv.price18), market.mmBps);
  const exitSpread = maxBig(market.baseSpreadBps, market.devSpreadBps) + pv.spreadBps;
  const liq = liquidation(
    position.isLong,
    position.size,
    position.entry,
    account.equityLiq - upnl,
    account.mm - mmThis,
    exitSpread,
    market.mmBps,
    pv.price18,
  );
  const marginUsageBps =
    account.equityLiq <= 0n ? BPS : minBig(BPS, mulDiv(maxBig(account.mm, 0n), BPS, account.equityLiq, true));
  return { upnlUsd6: upnl, ...liq, marginUsageBps };
}

export interface DecreasePreview {
  execPrice18: bigint;
  /** Realised PnL after the max-profit cap (usd6, signed). */
  realizedPnlUsd6: bigint;
  profitCapped: boolean;
  feeUsd6: bigint;
  /** What the reduce adds to (or takes from) collateral: PnL − fee. */
  netUsd6: bigint;
  /** Block at which a profitable reduce is allowed (`MIN_HOLD_BLOCKS`); undefined when allowed now. */
  holdReadyBlock: bigint | undefined;
}

/** Reduce or close at the status-matrix exit price (allowed in every status). */
export function previewDecrease(
  market: MarketRisk,
  pv: PriceView,
  position: OpenPosition,
  sizeDelta: bigint,
  headBlock: bigint,
): DecreasePreview {
  const exec = exitPrice(market, pv, position.isLong);
  let realized = pnl(position.isLong, sizeDelta, position.entry, exec);
  let profitCapped = false;
  let holdReadyBlock: bigint | undefined;
  if (realized > 0n) {
    const ready = position.openedBlock + RISK.MIN_HOLD_BLOCKS;
    if (headBlock < ready) holdReadyBlock = ready;
    const cap = bpsDown(notional(sizeDelta, position.entry), market.maxProfitBps);
    if (realized > cap) {
      realized = cap;
      profitCapped = true;
    }
  }
  const fee = bpsUp(notional(sizeDelta, exec), market.feeBps);
  return {
    execPrice18: exec,
    realizedPnlUsd6: realized,
    profitCapped,
    feeUsd6: fee,
    netUsd6: realized - fee,
    holdReadyBlock,
  };
}
