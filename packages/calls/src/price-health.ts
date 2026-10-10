/**
 * A market's price health in words, both apps (04-pricing R7, F7): "Live" only when the stream is open **and** the
 * market's settlement price is live; otherwise the cause, plainly — never a calm-looking line over a dead feed. The
 * chip, the chart's tag and the call panel all read this; neither app decides it.
 */
import type { FeedState } from "@senryo/config";
import type { MarketLine } from "./markets.ts";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

export type HealthTone = "live" | "late" | "off";

export interface PriceHealth {
  /** The price may be quoted and the line moves as live. */
  live: boolean;
  tone: HealthTone;
  /** The chip's word ("Live", "Delayed 12 s", "Closed", "Reconnecting"). */
  word: string;
  /** The chart's tag beside the price, or null while live. */
  tag: string | null;
  /** The call panel's notice when calls are held for the price, or null while live. */
  notice: string | null;
}

/** "12 s", "3 min". */
function ageText(ms: number): string {
  const sec = Math.max(0, Math.round(ms / MS_PER_SECOND));
  return sec < SECONDS_PER_MINUTE ? `${sec} s` : `${Math.round(sec / SECONDS_PER_MINUTE)} min`;
}

/**
 * `stream` is the stream's status, `state` the market's (`PriceBook.stateOf`), `ageMs` its newest price's age on the
 * server's clock, `line` its row line (closed or paused words).
 */
export function priceHealth(input: {
  stream: "idle" | "connecting" | "live" | "reconnecting";
  state: FeedState;
  ageMs: number | null;
  line: MarketLine;
}): PriceHealth {
  const { stream, state, ageMs, line } = input;
  const age = ageMs === null ? null : ageText(ageMs);
  if (line.paused) return { live: false, tone: "off", word: "Paused", tag: "Paused", notice: line.text };
  if (stream !== "live") {
    return {
      live: false,
      tone: "late",
      word: stream === "connecting" ? "Connecting" : "Reconnecting",
      tag: age ? `${age} old` : null,
      notice: "Reconnecting · calls resume when prices return",
    };
  }
  // Outside its session the market is closed, whatever its feed says (the calendar is the client's own).
  if (!line.trading || state === "closed") {
    return { live: false, tone: "off", word: "Closed", tag: "Closed", notice: line.text };
  }
  switch (state) {
    case "live":
      return { live: true, tone: "live", word: "Live", tag: null, notice: null };
    case "halted":
      return {
        live: false,
        tone: "off",
        word: "Halted",
        tag: "Halted",
        notice: "Halted while its price steadies · calls reopen on their own",
      };
    case "delayed":
    case "fallback":
      return {
        live: false,
        tone: "late",
        word: age ? `Delayed ${age}` : "Delayed",
        tag: age ? `${age} old` : "Delayed",
        notice: `Price delayed${age ? ` ${age}` : ""} · calls resume when it's live`,
      };
    default:
      return {
        live: false,
        tone: "off",
        word: age ? `No price ${age}` : "No price",
        tag: age ? `${age} old` : "No price",
        notice: "No fresh price · calls resume when it's back",
      };
  }
}
