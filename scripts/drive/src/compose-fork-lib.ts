/**
 * Fixtures of the composed-operation fork check (compose-fork-check.ts): exit-code checks, fork-only funding by
 * impersonation, a plain-EOA sender on the fork, the app's journal path for one composed step, and the one-operation
 * assertions every composed operation must pass. Local anvil only — never a real network.
 */
import { type ApiClient, type SwapQuoteOk, swapQuoteRoute } from "@senryo/api-client";
import { createSender, erc20Abi, externalCall, MemoryJournal, type ReadClient, type Sender } from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { type ComposedStep, type OperationRunOptions, sendTracked, stepsLine } from "@senryo/query";
import { beginOperation, builtOperation, progressOperation } from "../../../packages/query/src/operation-progress.ts";
import { operationsFor, readOperation, writeOperation } from "../../../packages/query/src/operations.ts";
import { anvil, type freshUser } from "./fork.ts";

const SLIPPAGE_BPS = 100;
const SETTLE_BLOCKS = "0x3";
/** Anvil's `safe` / `finalized` heads trail `latest` by 1 / 2 epochs (`--slots-in-an-epoch 1` → 1 / 2 blocks). */
const FINALITY_BLOCKS = "0x3";
const SAME_TIMESTAMP = "0x0";
const MINE_EVERY_MS = 1_500;
/** The fork loads remote state on first touch: a cold estimate can time out, a retry finds it warm. */
const WARM_ATTEMPTS = 4;
const HEX = 16;
const HOLDER_GAS = "0xde0b6b3a7640000";

export function forkKit(FORK: string, fork: ReadClient, api: ApiClient) {
  const failures: string[] = [];
  function check(ok: boolean, what: string): void {
    console.log(`${ok ? "✓" : "✗"} ${what}`);
    if (!ok) failures.push(what);
  }

  /** Lend the user a token from a big holder (fork-only impersonation). */
  async function lend(holder: string, token: string, to: string, amount: bigint, gas = false) {
    await anvil(FORK, "anvil_impersonateAccount", [holder]);
    if (gas) await anvil(FORK, "anvil_setBalance", [holder, HOLDER_GAS]);
    const call = externalCall(token as `0x${string}`, erc20Abi, "transfer", [to as `0x${string}`, amount], "approve");
    await anvil(FORK, "eth_sendTransaction", [{ from: holder, to: call.to, data: call.data }]);
  }
  const balanceOf = (token: string, who: string) =>
    fork.readContract({
      address: token as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [who as `0x${string}`],
    });

  /** One step, journalled as the app's trace does: begin (joins the operation) → build (a re-quote) → send → progress. */
  function journalled(sender: Sender, key: string) {
    return async (step: ComposedStep, _index: number, options: OperationRunOptions) => {
      const parent = options.operationId ? readOperation(options.operationId) : undefined;
      let record = beginOperation(
        key,
        sender.account.address,
        sender.chainId,
        step.action,
        options.reviewedIntent,
        parent,
        options.plannedActions,
      );
      writeOperation(record);
      const built = step.build ? await step.build() : step.request;
      // Raw JSON-RPC without a client timeout: the first touch of a pool's state on the fork can take tens of seconds.
      for (let attempt = 1; attempt <= WARM_ATTEMPTS; attempt += 1) {
        const warmed = await anvil(FORK, "eth_estimateGas", [
          {
            from: sender.account.address,
            to: built.to,
            data: built.data,
            value: `0x${(built.value ?? 0n).toString(HEX)}`,
          },
        ])
          .then(() => true)
          .catch((error: unknown) => String(error).includes("revert"));
        if (warmed) break;
      }
      record = builtOperation(record, built);
      writeOperation(record);
      const result = await sendTracked(
        sender,
        { ...built, meta: { ...built.meta, operationId: record.id, operationKey: key } },
        (event) => {
          record = progressOperation(record, event.stage, event.at, event.hash);
          writeOperation(record);
        },
        options,
      );
      return { ...result, operationId: record.id };
    };
  }

  const mine = async () => {
    await anvil(FORK, "anvil_mine", [SETTLE_BLOCKS]);
  };

  function userSender(user: ReturnType<typeof freshUser>): Sender {
    return createSender({
      chainId: MAINNET_CHAIN_ID,
      account: user,
      rpc: { http: [FORK] },
      read: fork,
      journal: new MemoryJournal(),
    });
  }

  /** The single operation of `key` for `user`: its record and the checks every composed operation must pass. */
  function checkOperation(label: string, user: string, key: string, steps: readonly ComposedStep[]) {
    const records = operationsFor(MAINNET_CHAIN_ID, user).filter((r) => r.key === key);
    const record = records[0];
    check(records.length === 1, `${label}: one journalled operation (${records.length})`);
    if (!record) return undefined;
    const actions = steps.map((s) => s.action);
    check(
      record.plannedActions.join(",") === actions.join(","),
      `${label}: planned in order ${record.plannedActions.join(" → ")}`,
    );
    check(
      record.steps.map((s) => s.action).join(",") === actions.join(",") &&
        record.steps.every((s) => s.outcome === "completed") &&
        record.outcome === "completed",
      `${label}: every step completed in that order (${record.steps.map((s) => `${s.action}:${s.outcome}`).join(" → ")})`,
    );
    check(
      record.reviewedIntent.steps === stepsLine(steps),
      `${label}: one reviewed intent — "${record.reviewedIntent.steps}"`,
    );
    return record;
  }

  async function swapQuote(from: string, to: string, amount: bigint, sender: string): Promise<SwapQuoteOk> {
    const q = await api.call(swapQuoteRoute, {
      query: {
        chainId: MAINNET_CHAIN_ID,
        from: from as `0x${string}`,
        to: to as `0x${string}`,
        amount,
        sender: sender as `0x${string}`,
        slippageBps: SLIPPAGE_BPS,
      },
    });
    if (q.status !== "ok") throw new Error(`no quote ${from} → ${to}: ${q.status}`);
    return q;
  }

  /** Keeps anvil's voted / finalized heads moving while the composed steps wait for them (stop / start). */
  const keepFinalizing = () => {
    let id: ReturnType<typeof setInterval> | undefined;
    const miner = {
      start: () => {
        id ??= setInterval(
          () => void anvil(FORK, "anvil_mine", [FINALITY_BLOCKS, SAME_TIMESTAMP]).catch(() => undefined),
          MINE_EVERY_MS,
        );
      },
      stop: () => {
        if (id) clearInterval(id);
        id = undefined;
      },
    };
    miner.start();
    return miner;
  };
  return { failures, check, lend, balanceOf, journalled, mine, userSender, checkOperation, swapQuote, keepFinalizing };
}

/**
 * Fork drift as the aggregator reports it: Monorail's `InsufficientLiquidity()` (an order-book hop priced on the live
 * chain, missing on the fork) and `TransactionExpired()` (a route timed for the live chain).
 */
const DRIFT_SELECTORS = ["0xbb55fd27", "0xe397952c"] as const;
const DRIFT_ATTEMPTS = 3;

/** Retries a fork scenario on drift with a fresh quote, re-forking at the live head first when `reset`. */
export function driftRetry(FORK: string, upstream: string) {
  const refork = () => anvil(FORK, "anvil_reset", [{ forking: { jsonRpcUrl: upstream } }]);
  const withDrift = async (label: string, scenario: () => Promise<void>, reset: boolean): Promise<void> => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await scenario();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const drift = DRIFT_SELECTORS.find((selector) => message.includes(selector));
        if (!drift || attempt >= DRIFT_ATTEMPTS) throw error;
        console.log(`~ ${label}: fork drift (${drift}) — ${reset ? "re-fork, " : ""}fresh quote`);
        if (reset) await refork();
      }
    }
  };
  return { refork, withDrift };
}
