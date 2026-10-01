import type { PositionView } from "@senryo/chain";
import {
  cancelTriggerRequest,
  type LiveMarket,
  placeTriggerRequest,
  triggerOrder,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { signedHash, useSendJournal } from "./send-outcome";
import type { TriggerKind } from "./tpsl";
import { alreadyActive, type LegState, legState, pendingTriggers } from "./trigger-legs";
import { useEnsureGas } from "./useGasTopUp";

const ORDER: readonly TriggerKind[] = ["sl", "tp"];

export interface TriggerLevel {
  kind: TriggerKind;
  price18: bigint;
}

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

  const marketKey = `ours-${market.marketId}`;
  const active = useMemo(
    () =>
      triggers.status === "fresh" || triggers.status === "stale"
        ? triggers.value.filter((t) => t.market_id === marketKey)
        : [],
    [triggers, marketKey],
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
      const ordered = ORDER.flatMap((kind) => levels.filter((l) => l.kind === kind));
      for (const kind of ORDER) if (!ordered.some((l) => l.kind === kind)) traces[kind].reset();
      setSkipped(undefined);
      const saved: TriggerKind[] = [];
      for (const [index, level] of ordered.entries()) {
        // A level that is already active (a retry after an unknown result landed) is done, not sent again.
        const done =
          alreadyActive(active, level.kind, level.price18) ||
          (
            await traces[level.kind].run(
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
            )
          )?.final?.stage === "finalized";
        if (!done) {
          const next = ordered[index + 1];
          if (next) setSkipped({ kind: next.kind, blocker: level.kind });
          break;
        }
        saved.push(level.kind);
        onSaved?.(level.kind);
      }
      return saved;
    },
    [sender, address, busy, unresolved, sl, tp, active, market.marketId, position.isLong, position.size, gas],
  );

  const remove = useCallback(
    async (orderId: string): Promise<void> => {
      const from = sender();
      if (!from || busy || unresolved) return;
      await removal.run(from, cancelTriggerRequest(env.chainId, orderId as `0x${string}`), {
        preflight: (request) => gas.preflight(request)(),
      });
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
    blocked: unresolved,
    ready: Boolean(account.client),
    save,
    remove,
  };
}
