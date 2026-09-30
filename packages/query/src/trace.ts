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
  type Sender,
  type SentTx,
  sendTx,
  type TxJournal,
  type TxRequest,
  waitForCommit,
} from "@senryo/chain";
import type { Address } from "@senryo/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";

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

export type TrackedResult = SentTx & { final: Confirmation | undefined };

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

export async function sendTracked(
  sender: Sender,
  request: TxRequest,
  onStage: (event: TraceEvent) => void,
): Promise<TrackedResult> {
  const emit = (stage: TraceStage, extra: Partial<TraceEvent> = {}) => onStage({ stage, at: Date.now(), ...extra });
  emit("checking");
  const gas = await planGas(sender, request);
  emit("signing");
  const tapped: Sender = { ...sender, journal: tapJournal(sender.journal, (e) => emit("signed", { hash: e.hash })) };
  const sent = await sendTx(tapped, { ...request, fixedGas: gas });
  if (sent.stage === "reverted") {
    emit("reverted", { hash: sent.hash });
    return { ...sent, final: undefined };
  }
  emit("proposed", { hash: sent.hash });
  const opts = { read: sender.read, heads: sender.heads };
  const voted = await waitForCommit(opts, sent.receipt, "voted");
  if (voted.stage === "voted") emit("voted", { hash: sent.hash });
  const final = await waitForCommit(opts, voted.receipt ?? sent.receipt, "finalized");
  await sender.journal?.update(sent.hash, {
    stage: final.stage,
    blockNumber: final.receipt?.blockNumber.toString(),
    blockHash: final.receipt?.blockHash,
  });
  emit(final.stage, { hash: sent.hash });
  return { ...sent, final };
}

/** Trace state for one ticket/position action; finalized → the account's queries refetch (buckets, positions). */
export function useSendTrace() {
  const env = useQueryEnv();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (sender: Sender, request: TxRequest): Promise<TrackedResult | undefined> => {
      setEvents([]);
      setRunning(true);
      const push = (event: TraceEvent) => setEvents((prev) => [...prev, event]);
      try {
        const result = await sendTracked(sender, request, push);
        const from = sender.account.address as Address;
        void queryClient.invalidateQueries({ queryKey: keys.account(env.chainId, from) });
        void queryClient.invalidateQueries({ queryKey: ["market", env.chainId] });
        return result;
      } catch (error) {
        push({ stage: "failed", at: Date.now(), error });
        return undefined;
      } finally {
        setRunning(false);
      }
    },
    [env.chainId, queryClient],
  );

  const reset = useCallback(() => setEvents([]), []);
  return { events, running, run, reset };
}
