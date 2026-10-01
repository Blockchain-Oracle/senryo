/**
 * Stop loss / take profit planned for an order that isn't open yet (S1b.8a, "open, then protect"; C42 parity). The
 * levels live in the same out-of-React draft store as the held-position child, under their own key (chain, account,
 * market), so they survive closing the child and the ticket. Nothing is signed when a plan is set: after the open
 * finalizes, the receipt places each level as its own transaction for the new position's size.
 */
import type { ChainId } from "@senryo/config";
import { parsePrice, type TriggerKind } from "./tpsl";
import { EMPTY_FIELD, type TriggerField, useTriggerDraft } from "./tpsl-draft";
import type { TriggerLevel } from "./useTriggerLegs";

const KINDS: readonly TriggerKind[] = ["sl", "tp"];

export function planKey(chainId: ChainId, address: string | undefined, marketId: number): string {
  return `plan:${chainId}:${address ?? "none"}:${marketId}`;
}

export function usePlannedTriggers(key: string) {
  const [draft, setDraft] = useTriggerDraft(key);
  const setField = (kind: TriggerKind, field: TriggerField) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [kind]: field } }));
  const levels: TriggerLevel[] = KINDS.flatMap((kind) => {
    const price18 = parsePrice(draft.fields[kind].price);
    return price18 === undefined ? [] : [{ kind, price18 }];
  });
  return {
    fields: draft.fields,
    setField,
    clear: (kind: TriggerKind) => setField(kind, EMPTY_FIELD),
    clearAll: () => setDraft(() => ({ fields: { sl: EMPTY_FIELD, tp: EMPTY_FIELD }, attempted: [] })),
    levels,
  };
}
