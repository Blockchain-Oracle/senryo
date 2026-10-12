/**
 * The caller's live book for every screen and sheet (R5.1): one valuation of every open call and ride, read by the
 * terminal's View-position pill and positions sheet, Home, Calls and the equity figures (`@senryo/calls`
 * `useLiveBook`).
 */
import { LiveBookProvider } from "@senryo/calls/react";
import type { ReactNode } from "react";
import { useAccount } from "~/lib/account/provider";

export function BookHost({ children }: { children: ReactNode }) {
  return <LiveBookProvider owner={useAccount().hint?.address}>{children}</LiveBookProvider>;
}
