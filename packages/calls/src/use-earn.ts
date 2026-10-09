/**
 * Earn, both apps (S7.6, D-287): supply dollars or withdraw shares at the next settled hour, or take a request back —
 * each one passkey prompt signing an `EarnRequest` (and, for a supply short on allowance, a permit for exactly that
 * amount to the share contract), relayed so no MON is needed. The amount is checked exactly against what's held.
 */

import { classifyAuthError, isSilent } from "@senryo/account";
import { earnRequestRoute } from "@senryo/api-client";
import {
  addressOf,
  EARN_KIND,
  type EarnKind,
  type EarnRequest,
  earnRequestTypedData,
  freshNonce,
  permitParts,
  permitRequest,
} from "@senryo/chain";
import { formatUnits, parseUnits } from "@senryo/core";
import { earnKeys, useEarn, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Caller } from "./caller.ts";
import { PERMIT_TTL_SEC } from "./constants.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const REQUEST_TTL_SEC = 600;
const MS_PER_SECOND = 1_000;

export interface EarnAmountCheck {
  value: bigint | undefined;
  ok: boolean;
  problem: string | null;
}

/** An exact amount within what can be spent (dollars to supply, or shares' value to withdraw). */
export function checkEarnAmount(amount: string, max: bigint | undefined): EarnAmountCheck {
  const parsed = parseUnits(amount, DOLLAR_DECIMALS);
  const value = parsed.ok ? parsed.value : undefined;
  const problem =
    amount && !parsed.ok
      ? "Enter an amount like 12.50"
      : value !== undefined && max !== undefined && value > max
        ? `You have $${formatUnits(max, DOLLAR_DECIMALS, CENTS)}`
        : null;
  return { value, ok: value !== undefined && value > 0n && max !== undefined && value <= max, problem };
}

export type EarnResult = { state: "sent"; txHash: string } | { state: "cancelled" };

export function useEarnFlow({ client, hint }: Caller) {
  const env = useQueryEnv();
  const queries = useQueryClient();
  const owner = hint?.address;
  const earn = useEarn(owner);
  const [pending, setPending] = useState<EarnKind | null>(null);

  const request = useCallback(
    async (kind: EarnKind, amount: bigint, prompt: string): Promise<EarnResult> => {
      if (!client || !owner) throw new Error("Sign in to use Earn");
      const account = "value" in earn ? earn.value.account : null;
      const now = Math.floor(Date.now() / MS_PER_SECOND);
      const r: EarnRequest = { kind, owner, amount, deadline: BigInt(now + REQUEST_TTL_SEC), nonce: freshNonce() };
      setPending(kind);
      try {
        const signed = await client.stepUp(async (signer) => {
          let permit = null;
          if (kind === EARN_KIND.supply && (account?.allowance ?? 0n) < amount) {
            const deadline = BigInt(now + PERMIT_TTL_SEC);
            const sig = await signer.signTypedData(
              permitRequest(env.chainId, {
                owner,
                spender: addressOf(env.chainId, "PoolShares"),
                value: amount,
                nonce: account?.permitNonce ?? 0n,
                deadline,
              }),
            );
            permit = { value: amount, deadline, ...permitParts(sig) };
          }
          const signature = await signer.signTypedData(earnRequestTypedData(env.chainId, r));
          return { signature, permit };
        }, prompt);
        const result = await env.api.call(earnRequestRoute, {
          body: { chainId: env.chainId, request: r, signature: signed.signature, permit: signed.permit },
        });
        void queries.invalidateQueries({ queryKey: earnKeys.all });
        if (result.state === "reverted") throw new Error("Refused on chain. Nothing moved.");
        return { state: "sent", txHash: result.txHash };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { state: "cancelled" };
        throw error;
      } finally {
        setPending(null);
      }
    },
    [client, owner, earn, env.chainId, env.api, queries],
  );

  const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;
  return {
    view: earn,
    pending,
    supply: (amount: bigint) => request(EARN_KIND.supply, amount, `Supply ${dollars(amount)} to the pool`),
    withdraw: (shares: bigint) => request(EARN_KIND.withdraw, shares, "Withdraw from the pool"),
    cancel: (supply: boolean) =>
      request(supply ? EARN_KIND.cancelSupply : EARN_KIND.cancelWithdraw, 0n, "Take the request back"),
  };
}
