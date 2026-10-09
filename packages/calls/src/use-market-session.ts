import { useServerSeconds } from "@senryo/live/react";
import { useMemo } from "react";
import { type MarketLine, marketLine, marketSession } from "./markets.ts";

const SECONDS_PER_MINUTE = 60;

/**
 * A market's row line on the server's clock: the session is worked out once a minute (it changes on 15-minute
 * boundaries), the window countdown every second.
 */
export function useMarketLine(symbol: string): MarketLine {
  const now = useServerSeconds();
  const minute = Math.floor(now / SECONDS_PER_MINUTE);
  const session = useMemo(() => marketSession(symbol, now), [symbol, minute]);
  return marketLine(session, now);
}
