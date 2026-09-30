/**
 * Transaction lifecycle (Monad commit states, context/02-monad/differences-from-ethereum.md §5):
 *   submitted (journalled, sent) → proposed (receipt at `latest`; speculative) → voted (block ≤ `safe`)
 *   → finalized (block ≤ `finalized`; the only stage money decisions use)
 * Terminal failures: reverted (receipt status 0) · abandoned (never included / dropped by a reorg; never resent blindly).
 * Shared by `packages/chain` (sender), `packages/api-client` (wire) and the apps' execution trace.
 */
export const TX_STAGES = ["submitted", "proposed", "voted", "finalized", "reverted", "abandoned"] as const;

export type TxStage = (typeof TX_STAGES)[number];

export const TERMINAL_TX_STAGES: ReadonlySet<TxStage> = new Set(["finalized", "reverted", "abandoned"]);

export function isTerminalStage(stage: TxStage): boolean {
  return TERMINAL_TX_STAGES.has(stage);
}
