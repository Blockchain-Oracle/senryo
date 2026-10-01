/**
 * Typed-data and message scope. In session: only our own EIP-712 domains, for the signer's own benefit (starter claim,
 * voucher, TP/SL trigger) and our own message formats. Spend allowances, Aurora intents (`OpenOrder`), Perpl key
 * enrolment, AUSD 3009 and anything unrecognised need a step-up (spec client.md "Session policy").
 */
import { RP_ID } from "@senryo/config";
import type { Address, TypedDataDefinition } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { MESSAGE_PREFIXES, SIWE_MAX_TTL_MS } from "../constants.ts";
import { STARTER_DOMAIN, TRIGGER_DOMAIN } from "../starter/typed-data.ts";
import { sameAddress, scopeTargets } from "./targets.ts";
import type { Action, PolicyContext, Verdict } from "./types.ts";

const typedReject: Verdict = { kind: "reject", action: undefined, reason: "typed-data", stepUp: true };
const messageReject: Verdict = { kind: "reject", action: undefined, reason: "message", stepUp: true };
const signs = (action: Action): Verdict => ({ kind: "sign", action, spendUsd6: 0n, rateLimited: false });

/** Domains + primary types a session may sign, keyed by the contract that verifies them. */
const SESSION_TYPES: Record<string, { domain: { name: string; version: string }; contract: "starterDrip" | "core" }> = {
  Claim: { domain: STARTER_DOMAIN, contract: "starterDrip" },
  Voucher: { domain: STARTER_DOMAIN, contract: "starterDrip" },
  // Off-chain gas top-up authorisation (S8.16c); the contract never accepts this type.
  TopUp: { domain: STARTER_DOMAIN, contract: "starterDrip" },
  TriggerOrder: { domain: TRIGGER_DOMAIN, contract: "core" },
};

export function evaluateTypedData(def: TypedDataDefinition, ctx: PolicyContext): Verdict {
  const rule = SESSION_TYPES[String(def.primaryType)];
  if (!rule) return typedReject;
  const domain = def.domain ?? {};
  const targets = scopeTargets(ctx.chainId);
  const verifying = rule.contract === "starterDrip" ? targets.starterDrip : targets.core;
  const message = def.message as { user?: Address };
  const ok =
    domain.name === rule.domain.name &&
    domain.version === rule.domain.version &&
    Number(domain.chainId) === ctx.chainId &&
    sameAddress(domain.verifyingContract as Address | undefined, verifying) &&
    sameAddress(message.user, ctx.self);
  return ok ? signs({ kind: "typed-data", primaryType: String(def.primaryType) }) : typedReject;
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
