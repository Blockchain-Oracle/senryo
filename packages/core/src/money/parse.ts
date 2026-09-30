import { oneUnit } from "./units.ts";

const DECIMAL_INPUT = /^(\d*)(?:\.(\d*))?$/;
const GROUPING = /,/g;

export type ParseUnitsError = "empty" | "malformed" | "too-many-decimals";

export type ParseUnitsResult = { ok: true; value: bigint } | { ok: false; error: ParseUnitsError };

/**
 * Parses user-typed decimal text ("1,234.5") into base units. Never truncates: more fraction digits than the unit
 * holds is an error the input shows, not a silently different amount. Negative input is malformed (amounts are
 * always entered positive; direction comes from the action).
 */
export function parseUnits(text: string, decimals: number): ParseUnitsResult {
  const cleaned = text.trim().replace(GROUPING, "");
  if (cleaned === "") return { ok: false, error: "empty" };
  const match = DECIMAL_INPUT.exec(cleaned);
  if (!match) return { ok: false, error: "malformed" };
  const [, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return { ok: false, error: "malformed" };
  if (fraction.length > decimals) return { ok: false, error: "too-many-decimals" };
  return { ok: true, value: BigInt(whole || "0") * oneUnit(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0") };
}
