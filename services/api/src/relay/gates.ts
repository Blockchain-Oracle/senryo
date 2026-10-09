import {
  ACTION_CLOSE,
  ACTION_OPEN,
  type Hex,
  intentDigest,
  type MarketIntent,
  seriesIdOf,
  windowIdOf,
} from "@senryo/chain";
import {
  CALENDARS,
  type CadenceSec,
  type ChainId,
  LOCKOUT_SEC,
  MARKETS,
  type MarketSpec,
  POOL_TERMS,
} from "@senryo/config";
import { scheduleOf, sessionCovers, sessionNow } from "@senryo/core";
import { HTTP_STATUS, HttpError } from "@senryo/service-common";
import { MAX_INTENT_TTL_SEC } from "./constants.ts";

/**
 * The relay's gates before anything is queued (CWF relay checklist, D-266): the chain is served, the window is the
 * clock's window for this market and cadence, calls are inside trading time, the deadline is near, the stake is within
 * the pool's terms, and a market with a session is open for the whole window (D-289). The chain re-checks everything;
 * these only spare a doomed transaction its gas.
 */
export interface IntentRequest {
  chainId: ChainId;
  intent: MarketIntent;
  signature: Hex;
  permit: { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex } | null;
  symbol: string;
  cadenceSec: number;
  start: number;
}

export interface CheckedIntent {
  digest: Hex;
  market: MarketSpec;
  cadenceSec: CadenceSec;
  seriesId: Hex;
  start: number;
  expiry: number;
}

export const bad = (message: string) => new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", message);
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** A window a call or a parlay leg names: listed, on the cadence, the right id, inside trading time. */
export function checkWindow(
  chainId: ChainId,
  w: { symbol: string; cadenceSec: number; start: number; windowId: Hex },
  nowSec: number,
  opening: boolean,
): Omit<CheckedIntent, "digest"> {
  const market = MARKETS.find((m) => m.symbol === w.symbol && m.chains.includes(chainId));
  if (!market) throw bad(`${w.symbol} is not listed on ${chainId}`);
  const cadenceSec = market.cadences.find((c) => c === w.cadenceSec);
  if (!cadenceSec) throw bad(`${w.symbol} has no ${w.cadenceSec}s windows`);
  if (w.start % cadenceSec !== 0) throw bad("window start is not on the cadence");
  const seriesId = seriesIdOf(market.symbol, cadenceSec);
  if (windowIdOf(seriesId, w.start) !== w.windowId) throw bad("windowId is not this market's window");
  const expiry = w.start + cadenceSec;
  if (nowSec < w.start || nowSec + LOCKOUT_SEC >= expiry) {
    throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "calls are closed for this window");
  }
  if (opening) {
    const schedule = scheduleOf(CALENDARS[market.calendarId].schedule);
    if (!sessionCovers(schedule, w.start, expiry)) {
      const when = sessionNow(schedule, nowSec).text ?? "Closed";
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", `${market.symbol} is closed · ${when}`);
    }
  }
  return { market, cadenceSec, seriesId, start: w.start, expiry };
}

export function checkDeadline(deadline: bigint, nowSec: number): void {
  const d = Number(deadline);
  if (d <= nowSec || d > nowSec + MAX_INTENT_TTL_SEC) throw bad("deadline must be within two minutes");
}

export function checkStake(chainId: ChainId, stake: bigint): void {
  const terms = POOL_TERMS[chainId];
  if (stake < terms.minStake || stake > terms.maxStake) throw bad("stake outside the pool's terms");
}

export function checkIntent(req: IntentRequest, nowSec: number): CheckedIntent {
  const { intent } = req;
  const opening = intent.action === ACTION_OPEN;
  const w = checkWindow(req.chainId, { ...req, windowId: intent.windowId }, nowSec, opening);
  checkDeadline(intent.deadline, nowSec);
  if (intent.recipient === ZERO_ADDRESS) throw bad("recipient is required");
  if (opening) {
    checkStake(req.chainId, intent.amount);
    if (intent.ticketId !== 0n) throw bad("an open names no ticket");
  } else if (intent.action === ACTION_CLOSE) {
    if (intent.ticketId === 0n || intent.amount === 0n) throw bad("a close names a ticket and shares");
  } else {
    throw bad("unknown action");
  }
  if (req.permit && Number(req.permit.deadline) <= nowSec) throw bad("permit expired");
  return { digest: intentDigest(req.chainId, intent), ...w };
}
