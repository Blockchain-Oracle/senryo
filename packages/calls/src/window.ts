/**
 * The window a call goes into: the current one while it trades. Calls close LOCKOUT_SEC before expiry, and the next
 * window takes calls only from its own start (its open print is K), so during the lockout there is nothing to call —
 * the terminal says "Next opens in 0:12" and rolls on at the boundary. Times are the server's, never the phone's.
 */
import { seriesIdOf, windowAt, windowIdOf } from "@senryo/chain";
import { type CadenceSec, LOCKOUT_SEC } from "@senryo/config";

export interface CallWindow {
  symbol: string;
  cadenceSec: CadenceSec;
  start: number;
  expiry: number;
  windowId: `0x${string}`;
  /** Calls are taken (more than LOCKOUT_SEC left). */
  trading: boolean;
  /** Seconds until calls close (≥ 0). */
  closesIn: number;
}

export function windowFor(symbol: string, cadenceSec: CadenceSec, nowSec: number): CallWindow {
  const w = windowAt(nowSec, cadenceSec);
  return {
    symbol,
    cadenceSec,
    start: w.start,
    expiry: w.expiry,
    windowId: windowIdOf(seriesIdOf(symbol, cadenceSec), w.start),
    trading: w.trading,
    closesIn: Math.max(0, w.expiry - LOCKOUT_SEC - nowSec),
  };
}

/** Seconds until the next window of this series opens (the current one's expiry). */
export const nextOpensIn = (w: CallWindow, nowSec: number): number => Math.max(0, w.expiry - nowSec);
