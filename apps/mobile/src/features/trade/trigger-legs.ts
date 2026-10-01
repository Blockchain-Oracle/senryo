/**
 * TP/SL outcomes, one per transaction (review R01). Saving a stop loss and a take profit is two independent
 * transactions, and removing a level is a third: each has its own trace, so the screen can say exactly which level was
 * saved, which wasn't and which is still unknown. Nothing here sends; it turns traces and the send journal into states
 * and words. "Nothing changed" is only ever said about one level whose own transaction provably didn't land.
 */
import type { JournalEntry } from "@senryo/chain";
import { isTerminalStage } from "@senryo/core";
import type { TraceEvent, TraceOutcome } from "@senryo/query";
import { settledOutcome } from "./send-outcome";
import type { TriggerKind } from "./tpsl";

/**
 * `not-sent`: failed before a signature left the device. `reverted`: mined and rejected. `dropped`: never mined.
 * `unknown`: signed, and the live watch lost it — TxRecovery settles it from the journal; it must not be re-entered.
 */
export type LegState = "idle" | "saving" | "saved" | "not-sent" | "reverted" | "dropped" | "unknown";
export type LegTone = "up" | "down" | "warn" | "muted";

export interface LegTrace {
  events: readonly TraceEvent[];
  running: boolean;
}

const FROM_OUTCOME: Readonly<Record<TraceOutcome, LegState>> = {
  finalized: "saved",
  reverted: "reverted",
  abandoned: "dropped",
  "not-sent": "not-sent",
  unknown: "unknown",
};

/** One leg's state from its own trace; a signed tx the watch lost takes its outcome from the journal once settled. */
export function legState(trace: LegTrace, journal: readonly JournalEntry[]): LegState {
  if (trace.running) return "saving";
  const outcome = settledOutcome(trace.events, journal);
  return outcome === undefined ? "idle" : FROM_OUTCOME[outcome];
}

export const LEG_NAME: Readonly<Record<TriggerKind, string>> = { sl: "Stop loss", tp: "Take profit" };

export interface LegMessage {
  text: string;
  tone: LegTone;
}

/** What to say under one level's inputs. `kept` reminds the user their typed level is still there to retry. */
export function legMessage(kind: TriggerKind, state: LegState): LegMessage | undefined {
  const name = LEG_NAME[kind];
  switch (state) {
    case "idle":
      return undefined;
    case "saving":
      return { text: `Saving ${name.toLowerCase()}…`, tone: "muted" };
    case "saved":
      return { text: `${name} saved · finalized.`, tone: "up" };
    case "not-sent":
      return { text: `${name} wasn’t sent, so it isn’t saved. Your level is kept; save again to retry.`, tone: "down" };
    case "reverted":
      return { text: `${name} was rejected onchain, so it isn’t saved. Your level is kept.`, tone: "down" };
    case "dropped":
      return { text: `${name} never reached a block, so it isn’t saved. Your level is kept.`, tone: "down" };
    case "unknown":
      return {
        text: `${name} was signed, but its result isn’t confirmed yet. Don’t enter it again; it appears above once it lands.`,
        tone: "warn",
      };
  }
}

/** The level that was never attempted because the one before it didn't save. */
export function skippedMessage(skipped: TriggerKind, blocker: TriggerKind): LegMessage {
  return {
    text: `${LEG_NAME[skipped]} wasn’t attempted because ${LEG_NAME[blocker].toLowerCase()} didn’t save. Your level is kept.`,
    tone: "warn",
  };
}

export function removalMessage(state: LegState): LegMessage | undefined {
  switch (state) {
    case "idle":
    case "saved":
      return undefined;
    case "saving":
      return { text: "Removing the level…", tone: "muted" };
    case "unknown":
      return {
        text: "The removal was signed, but its result isn’t confirmed yet. The list updates once it lands.",
        tone: "warn",
      };
    default:
      return { text: "That level wasn’t removed; it is still active.", tone: "down" };
  }
}

export interface PendingTrigger {
  hash: `0x${string}`;
  /** A level being placed (with its kind and price when recorded) or one being removed. */
  action: "place" | "remove";
  leg: TriggerKind | undefined;
  price18: bigint | undefined;
}

function bigintOrUndefined(text: string | undefined): bigint | undefined {
  return text !== undefined && /^\d+$/.test(text) ? BigInt(text) : undefined;
}

/**
 * Trigger transactions the journal still holds without a final result — a save interrupted by an app kill, or one a
 * live watch lost. While any exists for this market, saving again could duplicate a level, so the screen waits.
 * `own` are the hashes this screen's traces are already narrating.
 */
export function pendingTriggers(
  journal: readonly JournalEntry[],
  scope: { chainId: number; from: string; marketId: number },
  own: ReadonlySet<string>,
): PendingTrigger[] {
  return journal
    .filter((j) => !isTerminalStage(j.stage) && j.chainId === scope.chainId && !own.has(j.hash))
    .filter((j) => j.from.toLowerCase() === scope.from.toLowerCase())
    .filter(
      (j) =>
        j.meta?.kind === "cancelTrigger" ||
        (j.meta?.kind === "placeTrigger" && j.meta.marketId === String(scope.marketId)),
    )
    .map((j) => ({
      hash: j.hash,
      action: j.meta?.kind === "cancelTrigger" ? ("remove" as const) : ("place" as const),
      leg: j.meta?.leg === "sl" || j.meta?.leg === "tp" ? j.meta.leg : undefined,
      price18: bigintOrUndefined(j.meta?.price),
    }));
}

/** An active level identical to the one about to be saved: saving it again would only duplicate it. */
export function alreadyActive(
  active: readonly { takeProfit: boolean; triggerPrice: bigint }[],
  kind: TriggerKind,
  price18: bigint,
): boolean {
  return active.some((t) => t.takeProfit === (kind === "tp") && t.triggerPrice === price18);
}
