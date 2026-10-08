/**
 * The execution trace (F10 step 6, specs/client.md "Lifecycle"): risk check (the `eth_estimateGas` simulation) →
 * signed (Face ID / session) → proposed → voted → finalized, each stage timestamped for the trace rows. Built on
 * `@senryo/chain`'s one send path; never resends — a failure after signing is reported, and the journal (the app's
 * `kvJournal`) lets TxRecovery reconcile the same signed bytes on the next launch.
 */
import {
  type Confirmation,
  type JournalEntry,
  planGas,
  receiptFacts,
  type Sender,
  type SentTx,
  sendTx,
  type TxJournal,
  type TxRequest,
  waitForCommit,
} from "@senryo/chain";
import type { Address } from "@senryo/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useSyncExternalStore } from "react";
import { keys } from "./keys.ts";
import { beginOperation, builtOperation, progressOperation } from "./operation-progress.ts";
import {
  assertOperationScope,
  type OperationRecord,
  readOperation,
  subscribeOperations,
  writeOperation,
} from "./operations.ts";

export type TraceStage =
  | "checking"
  | "signing"
  | "signed"
  | "proposed"
  | "voted"
  | "finalized"
  | "reverted"
  | "abandoned"
  | "failed";

export interface TraceEvent {
  stage: TraceStage;
  at: number;
  hash?: `0x${string}` | undefined;
  error?: unknown;
}

export type TrackedResult = SentTx & { final: Confirmation | undefined; operationId?: string | undefined };

/**
 * What one request's events prove. `not-sent`: it failed before a signature left the device, so nothing changed.
 * `unknown`: it was signed and then the watch failed — the tx may still land (TxRecovery settles it from the journal),
 * so a caller must never report "nothing changed" or send a replacement. Undefined while the request is still running.
 */
export type TraceOutcome = "finalized" | "reverted" | "abandoned" | "not-sent" | "unknown";

const SIGNED_STAGES: ReadonlySet<TraceStage> = new Set<TraceStage>(["signed", "proposed", "voted"]);

export function traceOutcome(events: readonly TraceEvent[]): TraceOutcome | undefined {
  const last = events.at(-1);
  if (!last) return undefined;
  if (last.stage === "finalized" || last.stage === "reverted" || last.stage === "abandoned") return last.stage;
  if (last.stage !== "failed") return undefined;
  return events.some((e) => SIGNED_STAGES.has(e.stage)) ? "unknown" : "not-sent";
}

/** The hash a trace signed, if it got that far. */
export function signedHash(events: readonly TraceEvent[]): `0x${string}` | undefined {
  return events.find((e) => e.hash !== undefined)?.hash;
}

const OUTCOME_OF_STAGE: Partial<Record<JournalEntry["stage"], TraceOutcome>> = {
  finalized: "finalized",
  reverted: "reverted",
  abandoned: "abandoned",
};

/**
 * The trace's own outcome, with `unknown` replaced by the journal's once TxRecovery has settled that signed tx. Until
 * then it stays `unknown`: the only state in which a screen must neither retry nor say "nothing changed".
 */
export function settledOutcome(
  events: readonly TraceEvent[],
  journal: readonly JournalEntry[],
): TraceOutcome | undefined {
  const outcome = traceOutcome(events);
  if (outcome !== "unknown") return outcome;
  const hash = signedHash(events);
  const entry = journal.find((j) => j.hash === hash);
  return (entry ? OUTCOME_OF_STAGE[entry.stage] : undefined) ?? "unknown";
}

/** Fires `onPut` when chain journals a freshly signed tx (the moment between signature and broadcast). */
function tapJournal(inner: TxJournal | undefined, onPut: (entry: JournalEntry) => void): TxJournal {
  return {
    put: async (entry) => {
      onPut(entry);
      await inner?.put(entry);
    },
    update: async (hash, patch) => inner?.update(hash, patch),
    list: async () => (inner ? inner.list() : []),
    remove: async (hash) => inner?.remove(hash),
  };
}

/** Work that must succeed before signing (e.g. a gas top-up, S8.16c); a throw becomes the trace's `failed` event. */
export interface SendOptions {
  builderAction?: TxRequest["action"];
  preflight?: ((request: TxRequest) => Promise<void>) | undefined;
  /** Re-check reviewed scope and bounds after asynchronous gas preparation, immediately before signing. */
  revalidate?: (() => Promise<void> | void) | undefined;
  reviewedIntent?: Record<string, string> | undefined;
  /** Several transaction steps may share a reviewed operation (approval, execution, protection). */
  operationId?: string | undefined;
  plannedActions?: readonly string[] | undefined;
}

export async function sendTracked(
  sender: Sender,
  request: TxRequest,
  onStage: (event: TraceEvent) => void,
  options: SendOptions = {},
): Promise<TrackedResult> {
  const emit = (stage: TraceStage, extra: Partial<TraceEvent> = {}) => onStage({ stage, at: Date.now(), ...extra });
  emit("checking");
  await options.preflight?.(request);
  const gas = await planGas(sender, request);
  await options.revalidate?.();
  assertOperationScope(sender.chainId, sender.account.address);
  emit("signing");
  const tapped: Sender = { ...sender, journal: tapJournal(sender.journal, (e) => emit("signed", { hash: e.hash })) };
  const sent = await sendTx(tapped, {
    ...request,
    fixedGas: gas,
    validate: async () => {
      assertOperationScope(sender.chainId, sender.account.address);
      await request.validate?.();
      await options.revalidate?.();
    },
  });
  emit("proposed", { hash: sent.hash });
  const opts = { read: sender.read, heads: sender.heads };
  const voted = await waitForCommit(opts, sent.receipt, "voted");
  if (voted.stage === "voted") emit("voted", { hash: sent.hash });
  const final = await waitForCommit(opts, voted.receipt ?? sent.receipt, "finalized");
  if (final.stage === "abandoned") sender.nonces.resync(sender.account.address);
  await sender.journal?.update(sent.hash, {
    stage: final.stage,
    blockNumber: final.receipt?.blockNumber.toString(),
    blockHash: final.receipt?.blockHash,
  });
  emit(final.stage, { hash: sent.hash });
  return { ...sent, final };
}

interface TraceState {
  events: TraceEvent[];
  running: boolean;
  record?: OperationRecord | undefined;
  restored?: boolean;
}

const IDLE: TraceState = { events: [], running: false };

/**
 * Trace state lives outside React, keyed by the action (e.g. `trade:<chainId>:<marketId>`), so a screen remount mid-send
 * keeps the trace and the `running` flag — the hold can't be pressed again while a signed tx is in flight (S8.16a).
 */
const traces = new Map<string, TraceState>();
const listeners = new Map<string, Set<() => void>>();
subscribeOperations((record, live) => {
  if (live) return;
  const state = traces.get(record.key);
  const step = record.steps.at(-1);
  if (!state || !step) return;
  const stage =
    step.outcome === "completed"
      ? "finalized"
      : step.outcome === "reverted" || step.outcome === "abandoned"
        ? step.outcome
        : undefined;
  if (!stage) return;
  setTrace(record.key, (prev) => ({
    ...prev,
    record,
    running: false,
    events: [...prev.events, { stage, at: record.updatedAt, hash: step.hash as `0x${string}` }],
  }));
});

function restoredTrace(key: string): TraceState {
  const cached = traces.get(key);
  if (cached) return cached;
  const record = readOperation(key);
  if (!record) return IDLE;
  const step = record.steps.at(-1);
  const stages: Record<string, TraceStage> = { completed: "finalized", reverted: "reverted", abandoned: "abandoned" };
  const events: TraceEvent[] = [];
  if (step?.hash) events.push({ stage: "signed", at: record.updatedAt, hash: step.hash as `0x${string}` });
  // An unfinished signature stays unknown, never an automatically resumed send.
  events.push({
    stage: stages[step?.outcome ?? ""] ?? "failed",
    at: record.updatedAt,
    ...(step?.hash ? { hash: step.hash as `0x${string}` } : {}),
  });
  const state = { events, running: false, record, restored: true };
  traces.set(key, state);
  return state;
}

function setTrace(key: string, update: (prev: TraceState) => TraceState): void {
  traces.set(key, update(restoredTrace(key)));
  for (const listener of listeners.get(key) ?? []) listener();
}

function subscribeTrace(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/**
 * Trace state for one ticket/position action; finalized → the account's queries refetch (buckets, positions). Pass a
 * stable `key` to keep the trace across remounts; without one the trace is local to this component instance. One trace
 * holds one request: an action made of several transactions uses one trace per transaction, so no outcome is lost.
 */
export function useSendTrace(key?: string) {
  const queryClient = useQueryClient();
  const localKey = useId();
  const id = key ?? `local:${localKey}`;
  const state = useSyncExternalStore(
    (listener) => subscribeTrace(id, listener),
    () => restoredTrace(id),
    () => restoredTrace(id),
  );

  const run = useCallback(
    async (
      sender: Sender,
      request: TxRequest | (() => Promise<TxRequest>),
      options: SendOptions = {},
    ): Promise<TrackedResult | undefined> => {
      const previous = restoredTrace(id);
      if (previous.running) return undefined;
      // Reserve synchronously before reading the journal, so two taps cannot pass the same asynchronous gate.
      setTrace(id, (prev) => ({ ...prev, running: true }));
      let prior: TraceOutcome | undefined;
      try {
        const journal = (await sender.journal?.list()) ?? [];
        const unresolved = journal.some(
          (entry) =>
            entry.meta?.operationKey === id &&
            entry.from.toLowerCase() === sender.account.address.toLowerCase() &&
            entry.chainId === sender.chainId &&
            !["finalized", "reverted", "abandoned"].includes(entry.stage),
        );
        prior = unresolved ? "unknown" : settledOutcome(previous.events, journal);
      } catch {
        setTrace(id, () => previous);
        return undefined;
      }
      if (prior === "unknown" || (previous.events.length > 0 && prior === undefined)) {
        setTrace(id, () => previous);
        return undefined;
      }
      const parent = options.operationId ? readOperation(options.operationId) : undefined;
      let record: OperationRecord;
      try {
        if (options.operationId && !parent)
          throw new Error("The original operation is unavailable. Review its status before continuing.");
        record = beginOperation(
          id,
          sender.account.address,
          sender.chainId,
          typeof request === "function" ? (options.builderAction ?? "placeTrigger") : request.action,
          options.reviewedIntent,
          parent,
          options.plannedActions,
        );
        // Persist before a builder can request a signature.
        writeOperation(record);
      } catch (error) {
        setTrace(id, () => ({
          ...previous,
          running: false,
          events: [{ stage: "failed", at: Date.now(), error }],
        }));
        return undefined;
      }
      setTrace(id, () => ({ events: [], running: true, record }));
      const push = (event: TraceEvent) => {
        record = progressOperation(record, event.stage, event.at, event.hash);
        // Keep the signed/pending gate in memory even if persistence fails. Never broadcast without a journal.
        setTrace(id, (prev) => ({ ...prev, record, events: [...prev.events, event] }));
        writeOperation(record);
      };
      try {
        // A request that has to be built first (a signed TP/SL order): a build failure is this trace's `failed` event.
        assertOperationScope(sender.chainId, sender.account.address);
        await options.revalidate?.();
        const built = typeof request === "function" ? await request() : request;
        record = builtOperation(record, built);
        writeOperation(record);
        const result = await sendTracked(
          sender,
          {
            ...built,
            meta: {
              ...built.meta,
              operationId: record.id,
              operationKey: id,
              step: String(record.steps.length - 1),
            },
          },
          push,
          options,
        );
        const receipt = result.final?.receipt ?? result.receipt;
        record = {
          ...record,
          steps: record.steps.map((step) =>
            step.hash === result.hash
              ? {
                  ...step,
                  blockNumber: receipt.blockNumber.toString(),
                  blockHash: receipt.blockHash,
                  facts: receiptFacts(receipt, sender.chainId, built.to, built.binaryReceiptContext),
                }
              : step,
          ),
        };
        writeOperation(record);
        const from = sender.account.address as Address;
        void queryClient.invalidateQueries({ queryKey: keys.account(sender.chainId, from) });
        void queryClient.invalidateQueries({ queryKey: ["market", sender.chainId] });
        return { ...result, operationId: record.id };
      } catch (error) {
        try {
          push({ stage: "failed", at: Date.now(), error });
        } catch {
          /* signed gate is retained in memory */
        }
        return undefined;
      } finally {
        setTrace(id, (prev) => ({ ...prev, running: false }));
      }
    },
    [queryClient, id],
  );

  const reset = useCallback(() => {
    const state = restoredTrace(id);
    const outcome = traceOutcome(state.events);
    if (!state.running && outcome !== "unknown" && (state.events.length === 0 || outcome !== undefined)) {
      setTrace(id, () => IDLE);
    }
  }, [id]);
  return {
    events: state.events,
    running: state.running,
    record: state.record,
    restored: state.restored ?? false,
    run,
    reset,
  };
}
