/**
 * The caller's live book for every screen and sheet (R5.1): one valuation of every open call and ride, read by the
 * terminal's View-position pill and positions sheet, Home, Calls and the equity figures (`@senryo/calls`
 * `useLiveBook`), and recorded for replays on this phone (R5.19).
 */
import { LiveBookProvider } from "@senryo/calls/react";
import type { ReactNode } from "react";
import { useAppTrader } from "~/lib/account/guest";
import "~/lib/replay-store";

export function BookHost({ children }: { children: ReactNode }) {
  return <LiveBookProvider owner={useAppTrader().owner}>{children}</LiveBookProvider>;
}
