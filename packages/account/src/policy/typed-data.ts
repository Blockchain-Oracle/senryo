/**
 * Typed-data and message scope. In session: our own message formats and SIWE for our hosts. Every EIP-712 request —
 * USDC permit, EIP-3009 transfers, and until S2 any market intent — needs a step-up (D-266/D-267). The market intents
 * signed under a `SessionGrant` join the in-session list with the S2 contracts.
 */
import { RP_ID } from "@senryo/config";
import type { TypedDataDefinition } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { MESSAGE_PREFIXES, SIWE_MAX_TTL_MS } from "../constants.ts";
import { sameAddress } from "./targets.ts";
import type { Action, PolicyContext, Verdict } from "./types.ts";

const typedReject: Verdict = { kind: "reject", action: undefined, reason: "typed-data", stepUp: true };
const messageReject: Verdict = { kind: "reject", action: undefined, reason: "message", stepUp: true };
const signs = (action: Action): Verdict => ({ kind: "sign", action, spendUsd6: 0n, rateLimited: false });

export function evaluateTypedData(_def: TypedDataDefinition, _ctx: PolicyContext): Verdict {
  return typedReject;
}

function messageText(message: unknown): string | undefined {
  if (typeof message === "string") return message;
  return undefined;
}

/** Our prefixed formats, or SIWE for our hosts with a nonce and a short expiry, signed by the session address. */
export function evaluateMessage(message: unknown, ctx: PolicyContext, now: number): Verdict {
  const text = messageText(message);
  if (text === undefined) return messageReject;
  if (MESSAGE_PREFIXES.some((p) => text.startsWith(p))) return signs({ kind: "message", format: "prefixed" });
  const siwe = parseSiweMessage(text);
  const domainOk = siwe.domain === RP_ID || siwe.domain?.endsWith(`.${RP_ID}`) === true;
  const expiry = siwe.expirationTime?.getTime();
  const ok =
    domainOk &&
    sameAddress(siwe.address, ctx.self) &&
    siwe.chainId === ctx.chainId &&
    typeof siwe.nonce === "string" &&
    siwe.nonce.length > 0 &&
    expiry !== undefined &&
    expiry > now &&
    expiry - now <= SIWE_MAX_TTL_MS;
  return ok ? signs({ kind: "message", format: "siwe" }) : messageReject;
}
