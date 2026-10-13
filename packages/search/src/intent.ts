/**
 * A terminal link's intent (D-340) in a URL's query or a route's params: `lane=300&mode=ride&side=up&position=call:1019`.
 * Anything malformed is dropped, never guessed.
 */
import { CADENCES_SEC, type CadenceSec } from "@senryo/config";
import type { TerminalIntent } from "./types.ts";

const POSITION = /^(call|ride):\d{1,20}$/;

export type IntentParams = Partial<Record<"lane" | "mode" | "side" | "position", string>>;

export function intentParams(i: TerminalIntent): IntentParams {
  return {
    ...(i.lane ? { lane: String(i.lane) } : {}),
    ...(i.instrument ? { mode: i.instrument } : {}),
    ...(i.side ? { side: i.side } : {}),
    ...(i.position ? { position: i.position } : {}),
  };
}

/** `?lane=300&mode=call` (built by hand: React Native's URLSearchParams is partial). */
export function intentQuery(i: TerminalIntent): string {
  const q = Object.entries(intentParams(i))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return q ? `?${q}` : "";
}

export function parseIntent(
  read: (key: keyof IntentParams) => string | null | undefined,
): Omit<TerminalIntent, "symbol"> {
  const lane = Number(read("lane"));
  const mode = read("mode");
  const side = read("side");
  const position = read("position");
  return {
    ...(CADENCES_SEC.includes(lane as CadenceSec) ? { lane: lane as CadenceSec } : {}),
    ...(mode === "call" || mode === "ride" ? { instrument: mode } : {}),
    ...(side === "up" || side === "down" ? { side } : {}),
    ...(position && POSITION.test(position) ? { position } : {}),
  };
}

export const hasIntent = (i: Omit<TerminalIntent, "symbol">): boolean =>
  i.lane !== undefined || i.instrument !== undefined || i.side !== undefined || i.position !== undefined;
