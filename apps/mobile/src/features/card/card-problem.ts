/**
 * Why the card service can't show a card right now, by cause — never one "issuer not answering" for every failure.
 * A summary that fails because the session is for another network, the sign-in was cancelled or the phone is offline
 * says so with the action that fixes it; only a real issuer outage blames the issuer.
 */
import { AuthError, OutOfScopeError } from "@senryo/account";
import { ApiError, type CardSummary } from "@senryo/api-client";
import type { NetworkKey } from "~/lib/network";

/** Where the Kinpaku card service runs. Mainnet waits on a production card programme with the issuer. */
export const CARD_NETWORKS: ReadonlySet<NetworkKey> = new Set(["testnet"]);

export type CardProblem = "practice-only" | "sign-in" | "offline" | "not-set-up" | "issuer-down" | "unknown";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_GATEWAY = 502;
const NETWORK_FAILURE = 0;
const WRONG_NETWORK = /wrong network/i;
const SIGN_IN_CODES = new Set(["UNAUTHORIZED", "SIGNATURE_INVALID", "SIGNATURE_EXPIRED"]);
const NOT_SET_UP_CODES = new Set(["NOT_DEPLOYED", "ISSUER_UNAVAILABLE"]);

export function cardProblem(error: unknown, summary?: CardSummary): CardProblem | undefined {
  if (summary?.issuer.status === "issuer_unavailable") return "not-set-up";
  if (!error) return undefined;
  if (error instanceof AuthError || error instanceof OutOfScopeError) return "sign-in";
  if (error instanceof TypeError) return "offline";
  if (!(error instanceof ApiError)) return "unknown";
  if (error.status === HTTP_BAD_REQUEST && WRONG_NETWORK.test(error.message)) return "practice-only";
  if (error.status === HTTP_UNAUTHORIZED || SIGN_IN_CODES.has(error.code)) return "sign-in";
  if (error.status === NETWORK_FAILURE) return "offline";
  if (
    error.code === "UPSTREAM_UNAVAILABLE" ||
    (error.code === "ISSUER_UNAVAILABLE" && error.status === HTTP_BAD_GATEWAY)
  )
    return "issuer-down";
  if (NOT_SET_UP_CODES.has(error.code)) return "not-set-up";
  return "unknown";
}

export const CARD_PROBLEM_COPY: Record<CardProblem, { title: string; line: string; action: string }> = {
  "practice-only": {
    title: "Kinpaku runs in Practice",
    line: "The Mainnet card is coming",
    action: "Switch to Practice",
  },
  "sign-in": { title: "Sign in to see your card", line: "Your card session ended", action: "Sign in again" },
  offline: { title: "You’re offline", line: "Your card is safe. Reconnect to see it", action: "Retry" },
  "not-set-up": { title: "Card unavailable", line: "The card issuer isn’t set up here yet", action: "Retry" },
  "issuer-down": { title: "Card unavailable", line: "The card issuer isn’t answering", action: "Retry" },
  unknown: { title: "Couldn’t load your card", line: "Something went wrong on our side", action: "Retry" },
};
