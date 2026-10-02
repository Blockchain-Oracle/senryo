/**
 * The ticket's one commit control (the phone's `ticket-commit.ts`): what it says and whether it can be confirmed, from
 * the ticket's existing state — the core blocker chain decides, unchanged; this only words it. Order: a fee top-up in
 * progress → the first blocker → no amount → account or preview not ready → ready ("Slide to long"). A locked session is
 * not a blocker: confirming signs through the passkey.
 */
import { formatUnits, type GasShortReason, type TradeBlocker } from "@senryo/core";
import { MONEY } from "@/lib/format";
import type { ConfirmLevel } from "./confirm-level";
import type { GasStep } from "./use-gas-top-up";

export type Side = "long" | "short";
export type Fix = "addMoney" | "createAccount" | "maxLeverage" | "closePosition";

export interface CommitState {
  label: string;
  ready: boolean;
  busy?: boolean;
  fix?: Fix;
}

const RETRIABLE_GAS: ReadonlySet<GasShortReason> = new Set<GasShortReason>(["RELAYER_BUSY", "UNREACHABLE", "UNKNOWN"]);
const USD6 = 6;
const CENTS = 2;

function blockerLabel(b: TradeBlocker): { label: string; fix?: Fix } {
  switch (b.code) {
    case "OFFLINE":
      return { label: "You’re offline" };
    case "GEO_BLOCKED":
      return { label: "Mainnet trading unavailable" };
    case "NO_ACCOUNT":
      return { label: "Create an account to trade", fix: "createAccount" };
    case "OPPOSITE_SIDE":
      return { label: `You're ${b.heldLong ? "long" : "short"} · close it first`, fix: "closePosition" };
    case "INSUFFICIENT_FREE":
      return { label: "Insufficient funds", fix: "addMoney" };
    case "MARKET_CLOSED":
      return { label: "Market closed" };
    case "REOPENING":
      return { label: "Market reopening" };
    case "PRICE_PAUSED":
      return { label: "Price paused" };
    case "ENGINE_PAUSED":
      return { label: "Trading paused" };
    case "SETTLE_ONLY":
      return { label: "Closing only" };
    case "LEVERAGE_ABOVE_MAX":
      return { label: `Max leverage is ${b.maxLeverageX}×`, fix: "maxLeverage" };
    case "MARKET_FULL":
      return { label: "Market full" };
    case "PRICE_IMPACT":
      return { label: "Order too large" };
    case "BELOW_MIN":
      return { label: `Minimum position is ${MONEY}${formatUnits(b.minUsd6, USD6, CENTS)}` };
    case "SIMULATION_REVERTED":
      return { label: "Order check failed" };
    case "NO_GAS":
      // Never the word "gas" on screen (flow book B11): it is the network fee.
      if (b.reason === "NOT_ELIGIBLE") return { label: "Add MON for network fees", fix: "addMoney" };
      if (b.reason === "BUDGET_EXHAUSTED") return { label: "Free network fees used today" };
      return { label: "Slide to try again" };
  }
}

export function commitState(input: {
  side: Side;
  amountUsd6: bigint;
  blocker: TradeBlocker | undefined;
  gasStep: GasStep;
  hasAccount: boolean;
  clientReady: boolean;
  previewReady: boolean;
  confirmWith: ConfirmLevel;
}): CommitState {
  if (["signing", "sending", "settling", "waiting"].includes(input.gasStep.kind))
    return { label: "Preparing network fee…", ready: false, busy: true };
  const b = input.blocker;
  if (b) {
    const retryGas = b.code === "NO_GAS" && RETRIABLE_GAS.has(b.reason);
    const { label, fix } = blockerLabel(b);
    return { label, ready: retryGas && input.clientReady && input.previewReady, ...(fix ? { fix } : {}) };
  }
  if (input.amountUsd6 === 0n) return { label: "Enter an amount", ready: false };
  if (!input.hasAccount) return { label: "Create an account to trade", ready: false, fix: "createAccount" };
  if (!input.clientReady || !input.previewReady) return { label: "Preparing order…", ready: false, busy: true };
  const verb = `Slide to ${input.side}`;
  return { label: input.confirmWith === "passkey" ? `${verb} · passkey` : verb, ready: true };
}
