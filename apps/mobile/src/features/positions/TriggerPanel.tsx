import type { PositionView } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { previewDecrease, RISK } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { LEG_NAME, legMessage, removalMessage } from "~/features/trade/trigger-legs";
import { useTriggerLegs } from "~/features/trade/useTriggerLegs";
import { pct, price18, priceDecimalsOf, signedUsd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";
import { DEFAULT_TRIGGER_STEP_BPS, TRIGGER_STEPS_BPS } from "./constants";

const KINDS = [
  { value: "tp", label: "Take profit" },
  { value: "sl", label: "Stop loss" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

/**
 * F14 TP/SL on a held position (TriggerOrders.sol): active orders with Cancel; a new order N % from the oracle price
 * with the realised PnL previewed at the trigger; signed in session, placed by the user (in scope), executed by any
 * keeper when the accepted oracle price crosses. Closed sessions queue until the market opens (stated). One borderless
 * filled group under a plain heading: the levels already set as rows (side in colour and in words, Cancel beside each),
 * then the two selectors and the preview. Placing a level is the group's quiet plate — the page's one primary action
 * is the close hold pinned at the bottom.
 */
export function TriggerPanel({ market, position }: { market: LiveMarket; position: PositionView }) {
  const { color } = useTheme();
  const legs = useTriggerLegs(market, position);
  const [kind, setKind] = useState<Kind>("tp");
  const [stepBps, setStepBps] = useState<bigint>(DEFAULT_TRIGGER_STEP_BPS);
  const takeProfit = kind === "tp";
  const up = position.isLong === takeProfit;
  const trigger18 = up
    ? (market.pv.price18 * (RISK.BPS + stepBps)) / RISK.BPS
    : (market.pv.price18 * (RISK.BPS - stepBps)) / RISK.BPS;
  const atTrigger = previewDecrease(
    market.risk,
    { ...market.pv, price18: trigger18, status: "OPEN" },
    position,
    position.size,
    position.openedBlock + RISK.MIN_HOLD_BLOCKS,
  );
  const mine = legs.active;
  const busy = legs.busy;
  const symbol = ENGINE_MARKETS.find((m) => m.id === market.marketId)?.symbol ?? "";
  const decimals = priceDecimalsOf(market.marketId);
  const toneColor = { up: color.up, down: color.down, warn: color.warn, muted: color.inkMuted } as const;
  // One level per press, with its own outcome; the removal has its own too (review R01).
  const note = legMessage(kind, legs.states[kind]);
  const removal = removalMessage(legs.removing);

  return (
    <Panel style={styles.panel}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        TP / SL
      </Text>
      {mine.map((t) => (
        <View key={t.id} style={styles.row}>
          <Text style={[TYPE.rowAmount, styles.level, { color: t.takeProfit ? color.up : color.down }]}>
            {t.takeProfit ? "TP" : "SL"} · {price18(t.triggerPrice, priceDecimalsOf(market.marketId))} ·{" "}
            {t.size >= position.size ? "all" : "part"}
          </Text>
          <Button
            label="Cancel"
            size="sm"
            variant="outline"
            block={false}
            disabled={busy || legs.blocked}
            onPress={() => void legs.remove(t.id)}
          />
        </View>
      ))}
      {removal ? <Text style={[TYPE.rowDetail, { color: toneColor[removal.tone] }]}>{removal.text}</Text> : null}
      {legs.pending.map((t) => (
        <Text key={t.hash} style={[TYPE.rowDetail, { color: color.warn }]}>
          {t.action === "remove"
            ? "A removal is still being confirmed."
            : `${t.leg ? LEG_NAME[t.leg] : "A level"}${t.price18 === undefined ? "" : ` at ${price18(t.price18, decimals)}`} is still being confirmed.`}{" "}
          Placing is paused until it settles, so nothing is placed twice.
        </Text>
      ))}
      <Segmented options={KINDS} value={kind} onChange={setKind} label="Trigger kind" />
      <Segmented
        options={TRIGGER_STEPS_BPS.map((b) => ({ value: String(b), label: `${up ? "+" : "−"}${pct(b)}` }))}
        value={String(stepBps)}
        onChange={(v) => setStepBps(BigInt(v))}
        label="Distance from the oracle price"
      />
      <View>
        <KeyValue label={`${symbol} at`} value={price18(trigger18, priceDecimalsOf(market.marketId))} />
        <KeyValue label="Realised at trigger" value={signedUsd(atTrigger.netUsd6)} />
      </View>
      {market.pv.status !== "OPEN" ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          The market is {market.pv.status.toLowerCase()}: a crossing executes once it opens.
        </Text>
      ) : null}
      {note ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: toneColor[note.tone] }]}>
          {note.text}
        </Text>
      ) : null}
      <Button
        label={
          legs.placing
            ? "Placing…"
            : `Place ${takeProfit ? "TP" : "SL"} at ${price18(trigger18, priceDecimalsOf(market.marketId))}`
        }
        variant="secondary"
        disabled={busy || legs.blocked || !legs.ready || position.size === 0n}
        loading={legs.placing}
        onPress={() => void legs.save([{ kind, price18: trigger18 }])}
        accessibilityHint={`Closes the whole position when ${market.name} reaches ${price18(trigger18, priceDecimalsOf(market.marketId))}, ${pct(stepBps)} from now`}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  level: { flex: 1 },
});
