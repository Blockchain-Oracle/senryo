import type { DiagnosisKind } from "@senryo/core";

/** Human copy per failure — why, and what still works (the phone's `lib/copy/diagnosis.ts`, word for word). */
export const DIAGNOSIS_COPY: Record<DiagnosisKind, { headline: string; body: string }> = {
  offline: {
    headline: "You're offline",
    body: "Showing what we last knew. Actions come back when you reconnect.",
  },
  "rpc-down": {
    headline: "Monad RPC isn't answering",
    body: "We're rotating to the backup RPC. Last-good values stay on screen.",
  },
  "api-down": {
    headline: "Senryo's service is unreachable",
    body: "Your funds and positions are safe onchain. This is only the screen.",
  },
  "indexer-lag": {
    headline: "History is catching up",
    body: "The activity index is a few blocks behind. Balances read the chain directly.",
  },
  "perpl-down": {
    headline: "Perpl is unreachable",
    body: "Crypto orders are paused. Gold, silver and your card are unaffected.",
  },
  "oracle-stale": {
    headline: "Price paused",
    body: "The oracle hasn't updated. New risk is blocked; closing still works.",
  },
  "not-deployed": {
    headline: "Not live on this network yet",
    body: "This part of Senryo isn't deployed here. Switch network or check back soon.",
  },
  unknown: {
    headline: "Something went wrong",
    body: "Your funds and positions are safe onchain. This is only the screen.",
  },
};

export const ERROR_COPY = {
  retry: "Retry",
  retrying: "Retrying…",
  technical: "Technical details",
  staleFailed: "Latest refresh failed",
} as const;
