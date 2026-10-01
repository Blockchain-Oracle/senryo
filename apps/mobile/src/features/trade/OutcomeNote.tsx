/**
 * One line for a send's settled outcome on screens that stay put after sending (LP, card limit, collateral swap —
 * review S01): the shared contract, not the trace's last stage. `unknown` (signed, the live watch lost it) says not to
 * repeat it and the screen keeps its actions locked (`useOutcome().unresolved`); a revert says gas was paid; only a
 * failure before signing, or a send proven never mined, says nothing changed.
 */
import type { TraceEvent, TraceOutcome } from "@senryo/query";
import { Text } from "react-native";
import { TYPE, useTheme } from "~/theme";
import { useSettledOutcome } from "./send-outcome";

export function useOutcome(events: readonly TraceEvent[]): { outcome: TraceOutcome | undefined; unresolved: boolean } {
  const outcome = useSettledOutcome(events);
  return { outcome, unresolved: outcome === "unknown" };
}

export function OutcomeNote({
  outcome,
  thing,
  success,
}: {
  outcome: TraceOutcome | undefined;
  /** "deposit", "limit change", "swap". */
  thing: string;
  /** What a finalized send did, in the screen's words. */
  success?: string | undefined;
}) {
  const { color } = useTheme();
  switch (outcome) {
    case undefined:
      return null;
    case "finalized":
      return success ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.up }]}>
          {success}
        </Text>
      ) : null;
    case "unknown":
      return (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.warn }]}>
          This {thing} was signed, but its result isn’t confirmed yet. Don’t repeat it: it settles on its own, and this
          updates when it does.
        </Text>
      );
    case "reverted":
      return (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          The {thing} reverted onchain (gas was paid). Nothing else changed.
        </Text>
      );
    case "abandoned":
      return (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          The {thing} never reached a block. Nothing changed; you can try again.
        </Text>
      );
    case "not-sent":
      return (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          That didn’t go through before anything was signed. Nothing changed.
        </Text>
      );
  }
}
