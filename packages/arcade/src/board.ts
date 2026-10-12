/**
 * The game-over card's line for a ranked run (R7.1): checked by replay, your best, and where that best stands among
 * the board's players — "Checked by replay · your best 12,340 · 3rd on the board". Plain arithmetic for the ordinal,
 * not `Intl.PluralRules` (Hermes doesn't ship it).
 */
const TEENS_FROM = 11;
const TEENS_TO = 13;
const TEN = 10;
const HUNDRED = 100;
const SUFFIX: Readonly<Record<number, string>> = { 1: "st", 2: "nd", 3: "rd" };

export function ordinal(n: number): string {
  const teen = n % HUNDRED >= TEENS_FROM && n % HUNDRED <= TEENS_TO;
  return `${n}${teen ? "th" : (SUFFIX[n % TEN] ?? "th")}`;
}

export function rankNote(
  players: readonly { owner: string; score: number }[],
  me: string | undefined,
  best: number,
): string {
  const ahead = players.filter((p) => p.owner.toLowerCase() !== me && p.score > best).length;
  const rank = ahead + 1;
  const where = rank <= players.length + 1 ? ` · ${ordinal(rank)} on the board` : "";
  return `Checked by replay · your best ${best.toLocaleString()}${where}`;
}
