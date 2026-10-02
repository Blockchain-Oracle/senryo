/**
 * The trade blocker chain (F10, specs/flows.md): every ticket shows the **first** fixable cause and its action, in this
 * order — offline → geo (mainnet) → no account → insufficient Free to trade → market closed → price paused → leverage
 * above max → market full → below minimum → no gas → simulation revert. Pure: the apps pass what they already know.
 * Gas is last and is only a blocker when a top-up is impossible (S8.16b, D-171): a short balance is topped up at hold
 * time, so it never dead-ends a trade that would otherwise go through.
 * Reduce/close never go through this chain (allowed in every status, risk-math.md status matrix).
 */
import { formatUnits } from "./money/format.ts";
import { DECIMALS } from "./money/units.ts";
import type { MarketStatus } from "./risk/constants.ts";
import type { IncreasePreview } from "./risk/preview.ts";

export type TradeBlocker =
  | { code: "OFFLINE" }
  | { code: "GEO_BLOCKED"; country: string | null }
  | { code: "NO_ACCOUNT" }
  /** One net position per market (`PerpModule.sol` SideMismatch): the other side must be closed first (flow C3a). */
  | { code: "OPPOSITE_SIDE"; heldLong: boolean }
  | { code: "NO_GAS"; reason: GasShortReason; retryAfterSec?: number }
  | { code: "INSUFFICIENT_FREE"; shortUsd6: bigint }
  | { code: "MARKET_CLOSED"; opensAt: bigint | undefined }
  | { code: "REOPENING"; opensAt: bigint | undefined }
  | { code: "PRICE_PAUSED"; status: Extract<MarketStatus, "STALE" | "CIRCUIT" | "HALTED"> }
  | { code: "LEVERAGE_ABOVE_MAX"; maxLeverageX: number }
  | { code: "MARKET_FULL"; maxNotionalUsd6: bigint }
  | { code: "PRICE_IMPACT" }
  | { code: "BELOW_MIN"; minUsd6: bigint }
  | { code: "SIMULATION_REVERTED"; reason: string };

/** Why a gas top-up can't happen right now (the api's refusal codes; UNREACHABLE = the relay didn't answer). */
export type GasShortReason = "NOT_ELIGIBLE" | "BUDGET_EXHAUSTED" | "RELAYER_BUSY" | "UNREACHABLE" | "UNKNOWN";

/** ok = the balance covers limit × max fee · topup = short, topped up at hold time · unavailable = short, no top-up. */
export type GasGate =
  | { kind: "ok" }
  | { kind: "topup" }
  | { kind: "unavailable"; reason: GasShortReason; retryAfterSec?: number };

export interface TradeGateInput {
  online: boolean;
  /** Mainnet new risk is geofenced (D-038); practice never is. */
  mainnet: boolean;
  geoAllowed: boolean | undefined;
  country: string | null;
  hasAccount: boolean;
  /** Native balance vs this send's gas limit × max fee (see `GasGate`). */
  gas: GasGate;
  status: MarketStatus;
  /** Next open from the calendar (display only), for CLOSED / REOPENING copy. */
  opensAt: bigint | undefined;
  leverageX: number;
  maxLeverageX: number;
  /** Absent until the user entered an amount. */
  preview: IncreasePreview | undefined;
  /** Decoded revert from the pre-send simulation, when it ran and failed. */
  simulationRevert: string | undefined;
  /** The side of the position already open in this market, if any. */
  heldLong?: boolean;
}

export function firstTradeBlocker(input: TradeGateInput): TradeBlocker | undefined {
  if (!input.online) return { code: "OFFLINE" };
  if (input.mainnet && input.geoAllowed === false) return { code: "GEO_BLOCKED", country: input.country };
  if (!input.hasAccount) return { code: "NO_ACCOUNT" };
  const issues = input.preview?.issues ?? [];
  if (issues.some((i) => i.kind === "SIDE_MISMATCH") && input.heldLong !== undefined)
    return { code: "OPPOSITE_SIDE", heldLong: input.heldLong };
  const short = issues.find((i) => i.kind === "INSUFFICIENT_FREE");
  if (short) return { code: "INSUFFICIENT_FREE", shortUsd6: short.shortUsd6 };
  if (input.status === "CLOSED") return { code: "MARKET_CLOSED", opensAt: input.opensAt };
  if (input.status === "REOPENING") return { code: "REOPENING", opensAt: input.opensAt };
  if (input.status === "STALE" || input.status === "CIRCUIT" || input.status === "HALTED") {
    return { code: "PRICE_PAUSED", status: input.status };
  }
  if (input.leverageX > input.maxLeverageX) return { code: "LEVERAGE_ABOVE_MAX", maxLeverageX: input.maxLeverageX };
  const full = issues.find((i) => i.kind === "MARKET_FULL");
  if (full) return { code: "MARKET_FULL", maxNotionalUsd6: full.maxNotionalUsd6 };
  if (issues.some((i) => i.kind === "IMPACT_TOO_HIGH")) return { code: "PRICE_IMPACT" };
  const min = issues.find((i) => i.kind === "BELOW_MIN");
  if (min) return { code: "BELOW_MIN", minUsd6: min.minUsd6 };
  if (input.gas.kind === "unavailable") {
    return {
      code: "NO_GAS",
      reason: input.gas.reason,
      ...(input.gas.retryAfterSec !== undefined ? { retryAfterSec: input.gas.retryAfterSec } : {}),
    };
  }
  if (input.simulationRevert) return { code: "SIMULATION_REVERTED", reason: input.simulationRevert };
  return undefined;
}

export interface BlockerCopy {
  title: string;
  /** The fix, as a button label or a hint; absent when the user can only wait. */
  action?: string;
}

const dollars = (usd6: bigint) => `$${formatUnits(usd6, DECIMALS.usd6, DECIMALS.cents)}`;
const SECONDS_PER_MINUTE = 60n;
const MINUTES_PER_HOUR = 60n;
const HOURS_PER_DAY = 24n;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MS_PER_SECOND = 1000;
const TWO_DIGITS = 2;

/** "in 14h 02m" / "in 3d 4h" / "in 12m" from now (seconds). */
export function durationUntil(at: bigint, now: bigint): string {
  const total = at > now ? (at - now) / SECONDS_PER_MINUTE : 0n;
  const days = total / (MINUTES_PER_HOUR * HOURS_PER_DAY);
  const hours = (total / MINUTES_PER_HOUR) % HOURS_PER_DAY;
  const minutes = total % MINUTES_PER_HOUR;
  if (days > 0n) return `in ${days}d ${hours}h`;
  if (hours > 0n) return `in ${hours}h ${minutes.toString().padStart(TWO_DIGITS, "0")}m`;
  return `in ${minutes}m`;
}

/** "Sun 23:00 UTC" — UTC on purpose: sessions are defined in UTC and the calendar is conservative across DST. */
export function utcSlotLabel(at: bigint): string {
  const d = new Date(Number(at) * MS_PER_SECOND);
  const hh = d.getUTCHours().toString().padStart(TWO_DIGITS, "0");
  const mm = d.getUTCMinutes().toString().padStart(TWO_DIGITS, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${hh}:${mm} UTC`;
}

/**
 * The words for a blocker. `money` formats an amount in the selected network's money (P$ in Practice); without it,
 * dollars.
 */
export function blockerCopy(
  b: TradeBlocker,
  market: string,
  now: bigint,
  money: (usd6: bigint) => string = dollars,
): BlockerCopy {
  switch (b.code) {
    case "OFFLINE":
      return { title: "You're offline", action: "Trading resumes when you reconnect" };
    case "GEO_BLOCKED":
      return { title: "Mainnet trading isn't available in your region", action: "Practice mode is open to everyone" };
    case "NO_ACCOUNT":
      return { title: "Create an account to trade", action: "Create account" };
    case "OPPOSITE_SIDE":
      return { title: `You're ${b.heldLong ? "long" : "short"} ${market}`, action: "Close it first" };
    case "NO_GAS":
      return gasCopy(b.reason, b.retryAfterSec);
    case "INSUFFICIENT_FREE":
      return { title: `Add ${money(b.shortUsd6)} to trade`, action: "Add money" };
    case "MARKET_CLOSED":
      return {
        title: b.opensAt
          ? `${market} opens ${utcSlotLabel(b.opensAt)} · ${durationUntil(b.opensAt, now)}`
          : `${market} is closed`,
        action: "Closing and reducing still work",
      };
    case "REOPENING":
      return { title: `${market} is reopening`, action: "New positions open in a few minutes; closing works now" };
    case "PRICE_PAUSED":
      return { title: `${market} price paused`, action: "Closing still works; opens resume when the price confirms" };
    case "LEVERAGE_ABOVE_MAX":
      return { title: `Max leverage is ${b.maxLeverageX}×`, action: `Set to ${b.maxLeverageX}×` };
    case "MARKET_FULL":
      return { title: "Market full", action: `Try ≤ ${money(b.maxNotionalUsd6)}` };
    case "PRICE_IMPACT":
      return { title: "Too large for the pool right now", action: "Try a smaller size" };
    case "BELOW_MIN":
      return { title: `Minimum position is ${money(b.minUsd6)}`, action: "Increase the amount" };
    case "SIMULATION_REVERTED":
      return { title: b.reason };
  }
}

const SECONDS_PER_HOUR = 3_600;

/** Every refusal says why and what next — never an endless "Adding gas…" (phone test, S8.16b). */
function gasCopy(reason: GasShortReason, retryAfterSec: number | undefined): BlockerCopy {
  switch (reason) {
    case "NOT_ELIGIBLE":
      return {
        title: "Add MON for network fees",
        action: "Practice money and deposits include them",
      };
    case "BUDGET_EXHAUSTED": {
      const hours = retryAfterSec === undefined ? undefined : Math.max(1, Math.ceil(retryAfterSec / SECONDS_PER_HOUR));
      return {
        title: "Free network fees used today",
        action: hours === undefined ? "Add MON to your account to keep trading" : `More in ${hours}h · or add MON`,
      };
    }
    case "RELAYER_BUSY":
    case "UNREACHABLE":
    case "UNKNOWN":
      return { title: "Couldn't prepare network fees", action: "Slide again to retry" };
  }
}
