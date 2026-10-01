/**
 * "Open, then protect" (S1b.8a) on the receipt: once the order is finalized and the new position is read, each planned
 * level is placed as its own transaction for the position's size (`useTriggerLegs`: stop loss first; a level that
 * doesn't finalize stops the rest). Each level's outcome is its own line; a level that didn't land says the position
 * is open without it and where to add it. Runs once per receipt.
 */
import type { PositionView } from "@senryo/chain";
import type { LiveMarket } from "@senryo/query";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { price18, priceDecimalsOf } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { usePlannedTriggers } from "./planned-triggers";
import { LEG_NAME, receiptMessage } from "./trigger-legs";
import { useTriggerLegs } from "./useTriggerLegs";

export function ProtectAfterOpen({
  market,
  position,
  planKey,
}: {
  market: LiveMarket;
  position: PositionView | undefined;
  planKey: string;
}) {
  const { color } = useTheme();
  const plan = usePlannedTriggers(planKey);
  const levels = useRef(plan.levels).current;
  if (levels.length === 0) return null;
  if (!position) {
    return (
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        Placing your {levels.map((l) => LEG_NAME[l.kind].toLowerCase()).join(" and ")} once the position appears…
      </Text>
    );
  }
  return <Place market={market} position={position} planKey={planKey} />;
}

function Place({ market, position, planKey }: { market: LiveMarket; position: PositionView; planKey: string }) {
  const { color } = useTheme();
  const plan = usePlannedTriggers(planKey);
  const legs = useTriggerLegs(market, position);
  const levels = useRef(plan.levels).current;
  const started = useRef(false);
  const decimals = priceDecimalsOf(market.marketId);
  useEffect(() => {
    if (started.current || !legs.ready || levels.length === 0) return;
    started.current = true;
    void legs.save(levels, (kind) => plan.clear(kind));
  }, [legs, levels, plan]);
  const tone = { up: color.up, down: color.down, warn: color.warn, muted: color.text3 } as const;
  return (
    <View style={styles.stack}>
      {levels.map((l) => {
        const blocker = legs.skipped?.kind === l.kind ? legs.skipped.blocker : undefined;
        const note = receiptMessage(
          `${LEG_NAME[l.kind]} at $${price18(l.price18, decimals)}`,
          legs.states[l.kind],
          blocker,
        );
        return (
          <Text key={l.kind} accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: tone[note.tone] }]}>
            {note.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.xs },
});
