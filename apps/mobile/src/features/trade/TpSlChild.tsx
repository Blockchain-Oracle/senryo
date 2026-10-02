import type { PositionView } from "@senryo/chain";
import { previewDecrease, RISK } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { X } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { usePosition } from "~/features/positions/usePosition";
import { fire } from "~/feedback/fire";
import { pct, price18, priceDecimalsOf, signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { TRIGGER_SUGGESTIONS_BPS } from "./constants";
import { PlannedTriggers } from "./PlannedTriggers";
import { quantityText } from "./quantity";
import { TriggerInput } from "./TriggerInput";
import {
  bpsFromPrice,
  isAbove,
  parsePercent,
  parsePrice,
  percentText,
  priceFromBps,
  priceText,
  type TriggerKind,
  triggerProblem,
} from "./tpsl";
import { EMPTY_FIELD, type TriggerField, useTriggerDraft } from "./tpsl-draft";
import { LEG_NAME, type LegMessage, legMessage, removalMessage, skippedMessage } from "./trigger-legs";
import { type TriggerLevel, useTriggerLegs } from "./useTriggerLegs";

const TITLE = "Stop loss and take profit";
const SUBTITLE = "Closes your position at your price";
const PLANNED_SUBTITLE = "Closes the new position at your price";
const KINDS: readonly TriggerKind[] = ["sl", "tp"];

/**
 * The TP/SL sheet (Fomo F44/F45/M15; flow book C6): price or % for each level, the potential P/L, Clear, and Save —
 * which **replaces** the level of the same kind (`useTriggerLegs`: new first, then the old one is cancelled in the same
 * operation) and closes the whole position whatever its size then. With a position held it works on that position
 * and says so before any field (review R05); with none it plans levels for the order being entered (S1b.8a): nothing
 * is signed until the order opens, then each level is its own transaction with its own outcome (review R01).
 */
export function TpSlChild({
  open,
  onClose,
  market,
  held,
  isLong,
  previewLiq,
  planKey,
}: {
  open: boolean;
  onClose: () => void;
  market: LiveMarket;
  held: PositionView | undefined;
  /** The side being entered, for levels planned before the order opens. */
  isLong: boolean;
  previewLiq: bigint | null | undefined;
  planKey: string;
}) {
  return (
    <ChildSheet open={open} onClose={onClose} title={TITLE} subtitle={held ? SUBTITLE : PLANNED_SUBTITLE}>
      {held ? (
        <HeldTriggers market={market} position={held} onDone={onClose} />
      ) : (
        <PlannedTriggers market={market} isLong={isLong} liq18={previewLiq} planKey={planKey} onDone={onClose} />
      )}
    </ChildSheet>
  );
}

function HeldTriggers({
  market,
  position,
  onDone,
}: {
  market: LiveMarket;
  position: PositionView;
  onDone: () => void;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const p = usePosition(market.marketId);
  const legs = useTriggerLegs(market, position);
  const [{ fields, attempted }, setDraft] = useTriggerDraft(legs.scope);
  const setField = (kind: TriggerKind, field: TriggerField) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [kind]: field } }));
  const [focus, setFocus] = useState<TriggerKind | undefined>();
  const mark = market.pv.price18;
  const decimals = priceDecimalsOf(market.marketId);
  const liq = p.health?.liqPrice18;
  const side = position.isLong ? "Long" : "Short";
  const toneColor = { up: color.up, down: color.down, warn: color.warn, muted: color.text3 } as const;

  const priceOf = (kind: TriggerKind) => parsePrice(fields[kind].price);
  const problemOf = (kind: TriggerKind) => {
    const value = priceOf(kind);
    return value === undefined
      ? undefined
      : triggerProblem({ kind, isLong: position.isLong, price18: value, mark18: mark, liq18: liq });
  };
  const resultAt = (value: bigint) =>
    previewDecrease(
      market.risk,
      { ...market.pv, price18: value, status: "OPEN" },
      position,
      position.size,
      position.openedBlock + RISK.MIN_HOLD_BLOCKS,
    ).netUsd6;

  const setPrice = (kind: TriggerKind, text: string) => {
    const value = parsePrice(text);
    setField(kind, { price: text, percent: value ? percentText(bpsFromPrice(mark, value)) : "" });
  };
  const setPercent = (kind: TriggerKind, text: string) => {
    const bps = parsePercent(text);
    const value = bps === undefined ? undefined : priceFromBps(mark, bps, kind, position.isLong);
    setField(kind, { percent: text, price: value !== undefined && value > 0n ? priceText(value, decimals) : "" });
  };
  const clear = (kind: TriggerKind) => setField(kind, EMPTY_FIELD);

  const entered = KINDS.filter((k) => priceOf(k) !== undefined);
  const valid = entered.length > 0 && entered.every((k) => problemOf(k) === undefined);
  const busy = legs.busy;
  const saved = !busy && attempted.length > 0 && attempted.every((k) => legs.states[k] === "saved");

  const save = async () => {
    fire("press");
    const levels = entered.flatMap((kind): TriggerLevel[] => {
      const value = priceOf(kind);
      return value === undefined ? [] : [{ kind, price18: value }];
    });
    setDraft((d) => ({ ...d, attempted: levels.map((l) => l.kind) }));
    // Only a level whose own transaction finalized leaves its field; anything else stays typed for the retry. The
    // draft lives outside this component, so this also holds when the child was closed before the save finished.
    await legs.save(levels, (kind) => setField(kind, EMPTY_FIELD));
  };
  const noteOf = (kind: TriggerKind): LegMessage | undefined =>
    legs.skipped?.kind === kind ? skippedMessage(kind, legs.skipped.blocker) : legMessage(kind, legs.states[kind]);
  const removal = removalMessage(legs.removing);

  const suggestions = focus
    ? TRIGGER_SUGGESTIONS_BPS.filter((bps) => {
        const value = priceFromBps(mark, bps, focus, position.isLong);
        return (
          triggerProblem({ kind: focus, isLong: position.isLong, price18: value, mark18: mark, liq18: liq }) ===
          undefined
        );
      })
    : [];

  return (
    <>
      <View style={styles.identity} accessible accessibilityRole="text">
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>
          {market.name} · {side} · {quantityText(market.marketId, position.size)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {network.modeLabel} · whole position · mark ${price18(mark, decimals)}
        </Text>
      </View>
      {legs.pending.map((t) => (
        <Text key={t.hash} style={[TYPE.meta, { color: color.warn }]}>
          {t.action === "remove"
            ? "A removal is still being confirmed."
            : `${t.leg ? LEG_NAME[t.leg] : "A level"}${t.price18 === undefined ? "" : ` at $${price18(t.price18, decimals)}`} is still being confirmed.`}{" "}
          Saving waits for it.
        </Text>
      ))}
      {legs.active.map((t) => (
        <View key={t.id} style={styles.active}>
          <Text style={[TYPE.rowAmount, styles.flex, { color: t.takeProfit ? color.up : color.down }]}>
            {t.takeProfit ? "Take profit" : "Stop loss"} · ${price18(t.triggerPrice, decimals)}
          </Text>
          <Button
            label="Remove"
            size="sm"
            variant="outline"
            block={false}
            disabled={busy || legs.blocked}
            onPress={() => void legs.remove(t.id)}
          />
        </View>
      ))}
      {removal ? <Text style={[TYPE.meta, { color: toneColor[removal.tone] }]}>{removal.text}</Text> : null}
      {KINDS.map((kind) => {
        const value = priceOf(kind);
        const problem = problemOf(kind);
        const note = noteOf(kind);
        const sign = isAbove(kind, position.isLong) ? "+" : "−";
        return (
          <View key={kind} style={styles.group}>
            <View style={styles.fieldRow}>
              <Text style={[TYPE.rowStrong, styles.kind, { color: color.ink }]}>
                {kind === "sl" ? "Stop loss" : "Take profit"}
              </Text>
              <TriggerInput
                value={fields[kind].price}
                placeholder={kind === "sl" ? "SL price" : "TP price"}
                prefix="$"
                onChange={(text) => setPrice(kind, text)}
                onFocus={() => setFocus(kind)}
                label={`${kind === "sl" ? "Stop loss" : "Take profit"} price`}
              />
              <TriggerInput
                value={fields[kind].percent}
                placeholder="0"
                prefix={sign}
                suffix="%"
                onChange={(text) => setPercent(kind, text)}
                onFocus={() => setFocus(kind)}
                label={`${kind === "sl" ? "Stop loss" : "Take profit"} percent from mark`}
              />
            </View>
            <View style={styles.resultRow}>
              <Text style={[TYPE.meta, styles.flex, { color: problem ? color.down : color.text3 }]}>
                {problem
                  ? problemText(problem, position.isLong, decimals)
                  : `${kind === "sl" ? "Potential loss" : "Potential profit"}: ${value === undefined ? "" : signedUsd(resultAt(value))}`}
              </Text>
              <Pressable onPress={() => clear(kind)} accessibilityRole="button" hitSlop={SPACE.sm} style={styles.clear}>
                <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
                <Text style={[TYPE.meta, { color: color.text3 }]}>Clear</Text>
              </Pressable>
            </View>
            {note ? (
              <Text accessibilityLiveRegion="polite" style={[TYPE.meta, styles.note, { color: toneColor[note.tone] }]}>
                {note.text}
              </Text>
            ) : null}
          </View>
        );
      })}
      {liq === undefined || liq === null ? (
        <Text style={[TYPE.meta, { color: color.warn }]}>Liquidation check unavailable.</Text>
      ) : null}
      {saved ? <Text style={[TYPE.meta, { color: color.up }]}>Saved</Text> : null}
      <Button
        label={busy ? "Saving…" : "Save changes"}
        loading={busy}
        disabled={!valid || busy || legs.blocked || !legs.ready}
        onPress={() => void save()}
      />
      {saved ? <Button label="Done" variant="ghost" onPress={onDone} /> : null}
      <Text style={[TYPE.meta, styles.footnote, { color: color.text3 }]}>
        In fast markets a level can fill worse than its price.
      </Text>
      {suggestions.length > 0 ? (
        <View style={styles.suggestions} accessibilityLabel="Suggested levels">
          {suggestions.map((bps) => (
            <Suggestion
              key={String(bps)}
              label={`${focus && isAbove(focus, position.isLong) ? "+" : "−"}${pct(bps)}`}
              onPress={() => {
                fire("tick");
                if (focus) setPercent(focus, percentText(bps));
              }}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

/** A suggested distance for the focused field: a borderless filled chip that shrinks under the finger. */
function Suggestion({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.suggestion, { backgroundColor: pressed ? color.rowPressed : color.raised2 }]}
      >
        <Text style={[TYPE.chipCategory, { color: color.ink }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function problemText(problem: NonNullable<ReturnType<typeof triggerProblem>>, isLong: boolean, decimals: number) {
  const side = isLong ? "a long" : "a short";
  switch (problem.code) {
    case "NOT_POSITIVE":
      return "Enter a price above zero.";
    case "SIDE":
      return `For ${side}, this must be ${problem.above ? "above" : "below"} the oracle price.`;
    case "PAST_LIQUIDATION":
      return `Past the liquidation price ($${price18(problem.liq18, decimals)}): the position would liquidate first.`;
  }
}

const styles = StyleSheet.create({
  identity: { gap: SPACE.xxs },
  footnote: { textAlign: "center" },
  note: { paddingLeft: SIZE.avatarXl + SPACE.lg + SPACE.sm },
  active: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  group: { gap: SPACE.xs },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  kind: { width: SIZE.avatarXl + SPACE.lg },
  resultRow: { flexDirection: "row", alignItems: "center", paddingLeft: SIZE.avatarXl + SPACE.lg + SPACE.sm },
  clear: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs, minHeight: SIZE.touch },
  suggestions: { flexDirection: "row", gap: SPACE.sm },
  suggestion: {
    minHeight: SIZE.touch,
    borderRadius: BUTTON.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
