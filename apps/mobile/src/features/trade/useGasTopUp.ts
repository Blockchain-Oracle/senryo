/**
 * Gas at hold time (S8.16c, D-171): when the next send's budget (gas limit × the max fee it will sign) exceeds the
 * balance, sign `TopUp` with the session (in scope → no prompt while unlocked), let the sponsor send
 * `StarterDrip.topUp`, follow it to finalized, wait FUNDING_SETTLE_BLOCKS (Monad: a newly funded account spends only
 * after 3 blocks), then hand back to the ticket, which continues the same hold. Every refusal becomes a `GasGate`
 * reason with its own copy; nothing is retried automatically.
 */
import { classifyAuthError, isSilent, signStarterTopUp } from "@senryo/account";
import type { TxRequest } from "@senryo/chain";
import { FUNDING_SETTLE_BLOCKS } from "@senryo/config";
import { blockerCopy, type GasShortReason } from "@senryo/core";
import { gasBudgetFor, keys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { policyContext } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { isTerminal, StarterError, type StarterErrorCode, starter } from "~/lib/account/starter";
import { RELAY_POLL_MAX, RELAY_POLL_MS } from "~/lib/constants/auth";
import { BLOCK_POLL_MS, FUNDING_WAIT_POLLS } from "./constants";

export type GasStep =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "settling" }
  | { kind: "waiting" }
  | { kind: "failed"; reason: GasShortReason; retryAfterSec?: number };

/** A top-up either leaves the balance covering the send, or says why not (the ticket's NO_GAS reasons). */
export type TopUpOutcome = { ok: true } | { ok: false; reason: GasShortReason; retryAfterSec?: number };

const OK: TopUpOutcome = { ok: true };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reasonOf(code: StarterErrorCode): GasShortReason {
  if (code === "NOT_ELIGIBLE" || code === "BUDGET_EXHAUSTED" || code === "UNREACHABLE") return code;
  if (code === "RELAYER_BUSY" || code === "RELAY_REVERTED") return "RELAYER_BUSY";
  return "UNKNOWN";
}

export function useGasTopUp() {
  const env = useQueryEnv();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<GasStep>({ kind: "idle" });

  /** Resolves ok when the balance now covers `needWei` (or already did); otherwise `step` = failed with the reason. */
  const run = useCallback(
    async (needWei: bigint): Promise<TopUpOutcome> => {
      const client = account.client;
      const address = account.hint?.address;
      if (!client || !address) return { ok: false, reason: "NOT_ELIGIBLE" };
      try {
        setStep({ kind: "signing" });
        const signer = client.signer(policyContext(address, account.settings.faceId));
        const signed = await signStarterTopUp(signer, env.chainId, needWei, Date.now());
        setStep({ kind: "sending" });
        let relay = await starter.topUp(signed);
        setStep({ kind: "settling" });
        for (let i = 0; i < RELAY_POLL_MAX && !isTerminal(relay); i += 1) {
          await sleep(RELAY_POLL_MS);
          relay = await starter.relay(relay.relayId);
        }
        if (relay.stage !== "finalized" || relay.blockNumber === null) throw new StarterError("RELAY_REVERTED");
        setStep({ kind: "waiting" });
        const spendable = relay.blockNumber + FUNDING_SETTLE_BLOCKS;
        for (let i = 0; i < FUNDING_WAIT_POLLS && (await env.read.getBlockNumber()) < spendable; i += 1) {
          await sleep(BLOCK_POLL_MS);
        }
        await queryClient.invalidateQueries({ queryKey: keys.gas(env.chainId, address) });
        setStep({ kind: "idle" });
        return OK;
      } catch (error) {
        if (error instanceof StarterError) {
          if (error.code === "NOT_NEEDED") {
            setStep({ kind: "idle" });
            return OK;
          }
          const failure = {
            reason: reasonOf(error.code),
            ...(error.retryAfterSec !== undefined ? { retryAfterSec: error.retryAfterSec } : {}),
          };
          setStep({ kind: "failed", ...failure });
          return { ok: false, ...failure };
        }
        const kind = classifyAuthError(error);
        setStep(isSilent(kind) ? { kind: "idle" } : { kind: "failed", reason: "UNKNOWN" });
        return { ok: false, reason: "UNKNOWN" };
      }
    },
    [account.client, account.hint?.address, account.settings.faceId, env.chainId, env.read, queryClient],
  );

  const reset = useCallback(() => setStep({ kind: "idle" }), []);
  return { step, run, reset };
}

/**
 * For every other user send (close, reduce, TP/SL, LP): budget the request exactly as the sender will, and top up
 * first when the balance is short. Resolves true when the send can go ahead.
 */
export function useEnsureGas() {
  const env = useQueryEnv();
  const account = useAccount();
  const topUp = useGasTopUp();
  const ensure = useCallback(
    async (request: TxRequest): Promise<TopUpOutcome> => {
      const address = account.hint?.address;
      if (!address) return { ok: false, reason: "NOT_ELIGIBLE" };
      const [budget, balance] = await Promise.all([
        gasBudgetFor(env.read, address, request),
        env.read.getBalance({ address, blockTag: "latest" }),
      ]);
      return balance >= budget.needWei ? OK : topUp.run(budget.needWei);
    },
    [account.hint?.address, env.read, topUp.run],
  );
  /** As a trace `preflight`: a refusal throws, so the execution trace shows why instead of doing nothing. */
  const preflight = useCallback(
    (request: TxRequest) => async () => {
      const outcome = await ensure(request);
      if (outcome.ok) return;
      const copy = blockerCopy({ code: "NO_GAS", ...outcome }, "", 0n);
      throw new Error(copy.action ? `${copy.title} · ${copy.action}` : copy.title);
    },
    [ensure],
  );
  return { ensure, preflight, step: topUp.step, reset: topUp.reset };
}
