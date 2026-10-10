/**
 * Withdraw, both apps (S5.12; the full money-action contract): the recipient checked (a Monad address, not yours), an
 * exact amount within the balance, then one passkey prompt signing an EIP-3009 transfer the relay submits (no MON
 * needed). The screen keeps the stages (edit → review → sending → sent / failed); this is the check and the send.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { freshAuthNonce, transferAuthRequest } from "@senryo/chain";
import { formatUnits, parseUnits } from "@senryo/core";
import { useQueryEnv, useWithdraw } from "@senryo/query";
import { useCallback } from "react";
import type { Caller } from "./caller.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const AUTH_TTL_SEC = 3_600;
const MS_PER_SECOND = 1_000;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface WithdrawCheck {
  to: `0x${string}` | null;
  value: bigint | undefined;
  /** Ready to review. */
  ok: boolean;
  /** What to fix, in one line (null while there's nothing wrong to say). */
  problem: string | null;
  /**
   * Why Review waits while nothing is wrong yet (R2.15: a disabled button says why): the next field to fill, or the
   * balance still loading. Null once ready or while `problem` speaks.
   */
  hint: string | null;
}

export function checkWithdraw(
  to: string,
  amount: string,
  owner: string | undefined,
  balance: bigint | undefined,
): WithdrawCheck {
  const dest = to.trim();
  const parsed = parseUnits(amount, DOLLAR_DECIMALS);
  const value = parsed.ok ? parsed.value : undefined;
  const toOk = ADDRESS.test(dest) && dest.toLowerCase() !== owner?.toLowerCase();
  const enough = value !== undefined && balance !== undefined && value > 0n && value <= balance;
  const problem = !dest
    ? null
    : !toOk
      ? "Enter a Monad address (0x…) other than yours"
      : amount && !parsed.ok
        ? "Enter an amount like 12.50"
        : value !== undefined && balance !== undefined && value > balance
          ? `You have $${formatUnits(balance, DOLLAR_DECIMALS, CENTS)}`
          : null;
  const ok = toOk && enough;
  const hint =
    ok || problem
      ? null
      : balance === undefined
        ? "Reading your balance…"
        : !dest
          ? "Enter a Monad address"
          : value === undefined || value === 0n
            ? "Enter an amount"
            : null;
  return { to: toOk ? (dest as `0x${string}`) : null, value, ok, problem, hint };
}

export type WithdrawResult = { state: "sent"; txHash: string } | { state: "cancelled" };

export function useWithdrawFlow({ client, hint }: Caller) {
  const env = useQueryEnv();
  const owner = hint?.address;
  const withdraw = useWithdraw(owner);
  const send = useCallback(
    async (to: `0x${string}`, value: bigint): Promise<WithdrawResult> => {
      if (!client || !owner) throw new Error("Sign in to send");
      const authorization = {
        from: owner,
        to,
        value,
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / MS_PER_SECOND) + AUTH_TTL_SEC),
        nonce: freshAuthNonce(),
      };
      try {
        const signature = await client.stepUp(
          (signer) => signer.signTypedData(transferAuthRequest(env.chainId, authorization)),
          `Send $${formatUnits(value, DOLLAR_DECIMALS, CENTS)}`,
        );
        const result = await withdraw.mutateAsync({ authorization, signature });
        if (result.state === "reverted") throw new Error("The transfer was refused on chain. Nothing moved.");
        return { state: "sent", txHash: result.txHash };
      } catch (error) {
        if (isSilent(classifyAuthError(error))) return { state: "cancelled" };
        throw error;
      }
    },
    [client, owner, env.chainId, withdraw],
  );
  return { send, pending: withdraw.isPending };
}
