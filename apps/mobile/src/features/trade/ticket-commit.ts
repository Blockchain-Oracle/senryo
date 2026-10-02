/**
 * The ticket's one commit pill (D-177, C43; Codex S1b.7 consult #11): what it says and whether it can be held, from
 * the ticket's existing state — the core blocker chain decides, unchanged; this only words it. Order: a gas top-up in
 * progress → the first blocker → no amount → account or preview not ready → ready ("Hold to open Long/Short"). A
 * locked session is not a blocker: holding signs through Face ID, as before.
 */
import { formatUnits, type GasShortReason, type TradeBlocker } from "@senryo/core";
import type { GasStep } from "./useGasTopUp";
import type { Side } from "./useTicket";

export type Fix = "addMoney" | "createAccount" | "maxLeverage";

export interface CommitState {
  label: string;
  holdable: boolean;
  /** A transient top-up refusal: holding again retries (S8.16c). */
  retryGas: boolean;
  fix?: Fix;
}

const RETRIABLE_GAS: ReadonlySet<GasShortReason> = new Set<GasShortReason>(["RELAYER_BUSY", "UNREACHABLE", "UNKNOWN"]);
const USD6 = 6;
const CENTS = 2;

/** The hold button narrates a top-up in progress instead of a silent spinner (S8.16c). */
const GAS_STEP_LABEL: Partial<Record<GasStep["kind"], string>> = {
  signing: "Preparing…",
  sending: "Preparing…",
  settling: "Preparing…",
  waiting: "Preparing…",
};

function blockerLabel(b: TradeBlocker): { label: string; fix?: Fix } {
  switch (b.code) {
    case "OFFLINE":
      return { label: "You’re offline" };
    case "GEO_BLOCKED":
      return { label: "Mainnet trading unavailable" };
    case "NO_ACCOUNT":
      return { label: "Create an account to trade", fix: "createAccount" };
    case "INSUFFICIENT_FREE":
      return { label: "Insufficient funds", fix: "addMoney" };
    case "MARKET_CLOSED":
      return { label: "Market closed" };
    case "REOPENING":
      return { label: "Market reopening" };
    case "PRICE_PAUSED":
      return { label: "Price paused" };
    case "LEVERAGE_ABOVE_MAX":
      return { label: `Max leverage is ${b.maxLeverageX}×`, fix: "maxLeverage" };
    case "MARKET_FULL":
      return { label: "Market full" };
    case "PRICE_IMPACT":
      return { label: "Order too large" };
    case "BELOW_MIN":
      return { label: `Minimum position is $${formatUnits(b.minUsd6, USD6, CENTS)}` };
    case "SIMULATION_REVERTED":
      return { label: "Order check failed" };
    case "NO_GAS":
      if (b.reason === "NOT_ELIGIBLE") return { label: "Your account needs gas to trade", fix: "addMoney" };
      if (b.reason === "BUDGET_EXHAUSTED") return { label: "Today’s free gas is used up" };
      return { label: "Slide to retry preparation" };
  }
}

export function commitState(input: {
  side: Side;
  amountUsd6: bigint;
  blocker: TradeBlocker | undefined;
  gasStep: GasStep;
  hasAccount: boolean;
  ready: boolean;
  previewReady: boolean;
}): CommitState {
  const toppingUp = GAS_STEP_LABEL[input.gasStep.kind];
  if (toppingUp) return { label: toppingUp, holdable: false, retryGas: false };
  const b = input.blocker;
  if (b) {
    const retryGas = b.code === "NO_GAS" && RETRIABLE_GAS.has(b.reason);
    const { label, fix } = blockerLabel(b);
    return { label, holdable: retryGas && input.ready && input.previewReady, retryGas, ...(fix ? { fix } : {}) };
  }
  if (input.amountUsd6 === 0n) return { label: "Enter an amount", holdable: false, retryGas: false };
  if (!input.hasAccount)
    return { label: "Create an account to trade", holdable: false, retryGas: false, fix: "createAccount" };
  // `ready` is the account client being loaded (not the session lock: a locked session signs after Face ID).
  if (!input.ready || !input.previewReady) return { label: "Preparing order…", holdable: false, retryGas: false };
  return { label: `Slide to open ${input.side === "long" ? "Long" : "Short"}`, holdable: true, retryGas: false };
}
