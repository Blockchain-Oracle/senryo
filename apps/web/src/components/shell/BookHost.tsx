"use client";
/**
 * The caller's live book for every page and drawer (R5.1): one valuation of every open call and ride, read by the
 * terminal's positions column, Home, Calls and the equity figures (`@senryo/calls` `useLiveBook`), and recorded for
 * replays in this browser (R5.19).
 */
import { LiveBookProvider } from "@senryo/calls/react";
import type { ReactNode } from "react";
import { useAppTrader } from "@/lib/account/guest";
import "@/lib/replay-store";
import "@/lib/visit-store";

export function BookHost({ children }: { children: ReactNode }) {
  return <LiveBookProvider owner={useAppTrader().owner}>{children}</LiveBookProvider>;
}
