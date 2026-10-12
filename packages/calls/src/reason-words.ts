/**
 * Why a trade didn't go through, in plain words (R5.13): the relay reports the contract's revert or refusal by name
 * ("marketCommit would revert: WindowNotTrading(0x…)"); people read what happened and what to do instead.
 */
const WORDS: readonly (readonly [RegExp, string])[] = [
  [/WindowNotTrading|BadHorizon/, "This window has closed to calls — the next one opens at its boundary."],
  [/NoOpenPrint|open print is not available/, "This window's opening price isn't recorded yet — try in a moment."],
  [/slippage|REFUSE_SLIPPAGE|limit/i, "The price moved past your limit before the fill. Nothing was taken."],
  [/capacity|REFUSE_CAPACITY|full/i, "The pool has no more room on this window. Nothing was taken."],
  [/IsPaused|paused|halted/i, "Trading is paused on this market right now."],
  [/WrongConfig/, "The terms just changed — tap again to see the new price."],
  [/BadStake|BadRide|margin outside/i, "That amount is outside this market's limits."],
  [/HeldTooShort|MIN_HOLD/i, "A ride can close 3 seconds after it fills — tap again."],
  [/insufficient|allowance|balance/i, "Not enough dollars for this one."],
  [/expired|deadline/i, "The signature took too long — tap again."],
];

/** The reason in words, or `fallback` when it isn't one we know (never the raw revert). */
export function reasonWords(reason: string | null | undefined, fallback: string): string {
  if (!reason) return fallback;
  for (const [pattern, words] of WORDS) if (pattern.test(reason)) return words;
  return fallback;
}
