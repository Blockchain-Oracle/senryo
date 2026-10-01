import type { PositionView } from "@senryo/chain";
import {
  cancelTriggerRequest,
  type LiveMarket,
  placeTriggerRequest,
  signedHash,
  triggerOrder,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { useSendJournal } from "./send-outcome";
import type { TriggerKind } from "./tpsl";
import {
  alreadyActive,
  type LegState,
  legState,
  pendingTriggers,
  saveInOrder,
  type TriggerLevel,
} from "./trigger-legs";

export type { TriggerLevel };

import { useEnsureGas } from "./useGasTopUp";

const ORDER: readonly TriggerKind[] = ["sl", "tp"];

/**
 * TP/SL on a held position, one outcome per transaction (review R01). Each level and the removal have their own
 * trace, keyed by chain, account and market, so a remount keeps them; an app kill is covered by the journal
 * (`pending`). Levels are saved one at a time, stop loss first, and the first one that doesn't finalize stops the rest:
 * the caller keeps the unsaved inputs and clears only the levels `onSaved` names (also returned).
 */
export function useTriggerLegs(market: LiveMarket, position: PositionView) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const gas = useEnsureGas();
  const triggers = useTriggers(address);
  const scope = `trigger:${env.chainId}:${address ?? "none"}:${market.marketId}`;
  const sl = useSendTrace(`${scope}:sl`);
  const tp = useSendTrace(`${scope}:tp`);
  const removal = useSendTrace(`${scope}:remove`);
  const [skipped, setSkipped] = useState<{ kind: TriggerKind; blocker: TriggerKind } | undefined>();
  // Levels whose removal finalized here: gone from the list at once, before the indexer has caught up.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());

  const marketKey = `ours-${market.marketId}`;
  const active = useMemo(
    () =>
      triggers.status === "fresh" || triggers.status === "stale"
        ? triggers.value.filter((t) => t.market_id === marketKey && !removed.has(t.id))
        : [],
    [triggers, marketKey, removed],
  );

  const busy = sl.running || tp.running || removal.running;
  const sends = Number(sl.running) + Number(tp.running) + Number(removal.running) + sl.events.length + tp.events.length;
  const own = new Set(
    [sl, tp, removal].map((t) => signedHash(t.events)).filter((h): h is `0x${string}` => h !== undefined),
  );
  const [watch, setWatch] = useState(false);
  const journal = useSendJournal(watch, sends);
  const states: Record<TriggerKind, LegState> = { sl: legState(sl, journal), tp: legState(tp, journal) };
  const removing = legState(removal, journal);
  const pending = address
    ? pendingTriggers(journal, { chainId: env.chainId, from: address, marketId: market.marketId }, own)
    : [];
  const unresolved = pending.length > 0 || states.sl === "unknown" || states.tp === "unknown" || removing === "unknown";
  useEffect(() => setWatch(unresolved), [unresolved]);

  const sender = useCallback(() => {
    const client = account.client;
    return client && address ? userSender(client, address, account.settings.faceId) : undefined;
  }, [account.client, account.settings.faceId, address]);

  const save = useCallback(
    async (levels: readonly TriggerLevel[], onSaved?: (kind: TriggerKind) => void): Promise<TriggerKind[]> => {
      const from = sender();
      if (!from || !address || busy || unresolved) return [];
      const traces = { sl, tp };
      for (const kind of ORDER) if (!levels.some((l) => l.kind === kind)) traces[kind].reset();
      setSkipped(undefined);
      const run = await saveInOrder(
        levels,
        (level) => alreadyActive(active, level.kind, level.price18),
        async (level) => {
          const result = await traces[level.kind].run(
            from,
            () =>
              placeTriggerRequest(
                from,
                triggerOrder({
                  user: address,
                  marketId: market.marketId,
                  isLong: position.isLong,
                  takeProfit: level.kind === "tp",
                  triggerPrice18: level.price18,
                  sizeDelta: position.size,
                }),
              ),
            { preflight: (request) => gas.preflight(request)() },
          );
          return result?.final?.stage === "finalized";
        },
        onSaved,
      );
      setSkipped(run.skipped);
      return run.saved;
    },
    [sender, address, busy, unresolved, sl, tp, active, market.marketId, position.isLong, position.size, gas],
  );

  const remove = useCallback(
    async (orderId: string): Promise<void> => {
      const from = sender();
      if (!from || busy || unresolved) return;
      const result = await removal.run(from, cancelTriggerRequest(env.chainId, orderId as `0x${string}`), {
        preflight: (request) => gas.preflight(request)(),
      });
      if (result?.final?.stage === "finalized") setRemoved((prev) => new Set(prev).add(orderId));
    },
    [sender, busy, unresolved, removal, env.chainId, gas],
  );

  return {
    scope,
    active,
    states,
    removing,
    skipped,
    pending,
    busy,
    /** A level is being placed (as opposed to one being removed). */
    placing: sl.running || tp.running,
    blocked: unresolved,
    ready: Boolean(account.client),
    save,
    remove,
  };
}
