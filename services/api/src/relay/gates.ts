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

const bad = (message: string) => new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", message);

export function checkIntent(req: IntentRequest, nowSec: number): CheckedIntent {
  const { intent } = req;
  const market = MARKETS.find((m) => m.symbol === req.symbol && m.chains.includes(req.chainId));
  if (!market) throw bad(`${req.symbol} is not listed on ${req.chainId}`);
  const cadenceSec = market.cadences.find((c) => c === req.cadenceSec);
  if (!cadenceSec) throw bad(`${req.symbol} has no ${req.cadenceSec}s windows`);
  if (req.start % cadenceSec !== 0) throw bad("window start is not on the cadence");
  const seriesId = seriesIdOf(market.symbol, cadenceSec);
  if (windowIdOf(seriesId, req.start) !== intent.windowId) throw bad("windowId is not this market's window");
  const expiry = req.start + cadenceSec;
  if (nowSec < req.start || nowSec + LOCKOUT_SEC >= expiry) {
    throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "calls are closed for this window");
  }
  const deadline = Number(intent.deadline);
  if (deadline <= nowSec || deadline > nowSec + MAX_INTENT_TTL_SEC) throw bad("deadline must be within two minutes");
  if (intent.recipient === "0x0000000000000000000000000000000000000000") throw bad("recipient is required");
  if (intent.action === ACTION_OPEN) {
    const schedule = scheduleOf(CALENDARS[market.calendarId].schedule);
    if (!sessionCovers(schedule, req.start, expiry)) {
      const when = sessionNow(schedule, nowSec).text ?? "Closed";
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", `${market.symbol} is closed · ${when}`);
    }
    const terms = POOL_TERMS[req.chainId];
    if (intent.amount < terms.minStake || intent.amount > terms.maxStake) throw bad("stake outside the pool's terms");
    if (intent.ticketId !== 0n) throw bad("an open names no ticket");
  } else if (intent.action === ACTION_CLOSE) {
    if (intent.ticketId === 0n || intent.amount === 0n) throw bad("a close names a ticket and shares");
  } else {
    throw bad("unknown action");
  }
  if (req.permit && Number(req.permit.deadline) <= nowSec) throw bad("permit expired");
  return { digest: intentDigest(req.chainId, intent), market, cadenceSec, seriesId, start: req.start, expiry };
}
