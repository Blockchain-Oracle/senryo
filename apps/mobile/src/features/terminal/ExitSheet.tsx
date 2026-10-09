/**
 * A call's exit (S8.4, D-292; the web's `ExitModal`): take profit, a stop and a trail, each set in what the call would
 * cash out for — Off, a preset from today's value, then the stepper (21st #29940) — with "never below" under a stop or
 * a trail. It runs with the app closed and sells every share left; the price that fills decides, so it never sells
 * outside what is set here.
 */
import {
  type BidBounds,
  type ExitState,
  type ExitValues,
  exitPricesOf,
  exitProblem,
  exitStep,
  exitStepCents,
  exitValuesOf,
  floorStart,
  STOP_STEPS_BPS,
  TAKE_PROFIT_STEPS_BPS,
  TRAIL_CENTS,
  TRAIL_MAX_CENTS,
  valueAtBid,
} from "@senryo/calls";
import { type ExitPrices, formatUnits, hasExit } from "@senryo/core";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Stepper } from "~/components/kit/Stepper";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CENT = 10_000n;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;
const toCents = (v: bigint) => Number(v / CENT);
const fromCents = (c: number) => BigInt(c) * CENT;
const centsText = (c: number) => dollars(fromCents(c));
const NO_EXIT: ExitPrices = { takeProfitE6: 0, stopLossE6: 0, floorE6: 0, trailE6: 0 };

function Chip(p: { on: boolean; onPress: () => void; text: string; label?: string }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: p.on }}
      accessibilityLabel={p.label ?? p.text}
      onPress={() => {
        fire("tick");
        p.onPress();
      }}
      style={[styles.chip, { backgroundColor: p.on ? color.ink : color.raised2 }]}
    >
      <Text style={[TYPE.rowTitle, { color: p.on ? color.ground : color.ink }]}>{p.text}</Text>
    </Pressable>
  );
}

function Row(p: { title: string; hint: string; children: ReactNode; stepper: ReactNode | null }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.title}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.hint}</Text>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={p.title}>
        {p.children}
      </View>
      {p.stepper}
    </View>
  );
}

export function ExitSheet(p: {
  shares: bigint;
  nowBidE6: number;
  exit: ExitState | null;
  bounds: BidBounds;
  pending: boolean;
  onSet: (prices: ExitPrices) => void;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const now = valueAtBid(p.nowBidE6, p.shares);
  const top = toCents(valueAtBid(p.bounds.maxBidE6, p.shares));
  const bottom = Math.max(1, toCents(valueAtBid(p.bounds.minBidE6, p.shares)));
  const nowCents = toCents(now);
  const step = exitStepCents(top);
  const [v, setV] = useState<ExitValues>(() => exitValuesOf(p.exit, p.shares));
  const set = (patch: Partial<ExitValues>) => setV((old) => ({ ...old, ...patch }));
  const prices = exitPricesOf(v, p.shares);
  const problem = exitProblem(prices, p.shares, p.nowBidE6, p.bounds);
  const armed = p.exit !== null && hasExit(p.exit);
  const steps = (list: readonly bigint[], key: "takeProfit" | "stopLoss") =>
    list.flatMap((bps) => {
      const value = exitStep(now, bps, p.shares, p.bounds);
      return value === null
        ? []
        : [
            <Chip
              key={String(bps)}
              on={v[key] === value}
              onPress={() => set({ [key]: value })}
              text={dollars(value)}
            />,
          ];
    });

  return (
    <Sheet onClose={p.onClose} closeLabel="Close exit">
      <SheetHeading title="Exit" body={`Worth ${dollars(now)} now · runs with the app closed`} />
      <View style={styles.body}>
        <Row
          title="Take profit"
          hint="Sells when it's worth at least"
          stepper={
            v.takeProfit === null ? null : (
              <Stepper
                label="Take profit"
                value={toCents(v.takeProfit)}
                min={Math.min(nowCents + 1, top)}
                max={top}
                step={step}
                format={centsText}
                onChange={(c) => set({ takeProfit: fromCents(c) })}
              />
            )
          }
        >
          <Chip on={v.takeProfit === null} onPress={() => set({ takeProfit: null })} text="Off" />
          {steps(TAKE_PROFIT_STEPS_BPS, "takeProfit")}
        </Row>
        <Row
          title="Stop"
          hint="Sells when it's worth at most"
          stepper={
            v.stopLoss === null ? null : (
              <Stepper
                label="Stop"
                value={toCents(v.stopLoss)}
                min={bottom}
                max={Math.max(bottom, nowCents - 1)}
                step={step}
                format={centsText}
                onChange={(c) => set({ stopLoss: fromCents(c) })}
              />
            )
          }
        >
          <Chip on={v.stopLoss === null} onPress={() => set({ stopLoss: null })} text="Off" />
          {steps(STOP_STEPS_BPS, "stopLoss")}
        </Row>
        <Row
          title="Trail"
          hint="Sells after a drop from its best"
          stepper={
            v.trailCents === null ? null : (
              <Stepper
                label="Trail"
                value={v.trailCents}
                min={1}
                max={TRAIL_MAX_CENTS}
                format={(c) => `${c}¢ a share`}
                onChange={(c) => set({ trailCents: c })}
              />
            )
          }
        >
          <Chip on={v.trailCents === null} onPress={() => set({ trailCents: null })} text="Off" />
          {TRAIL_CENTS.map((c) => (
            <Chip
              key={c}
              on={v.trailCents === c}
              onPress={() => set({ trailCents: c })}
              text={`${c}¢`}
              label={`Trail ${c} cents`}
            />
          ))}
        </Row>
        {v.stopLoss !== null || v.trailCents !== null ? (
          <Row
            title="Never below"
            hint="The least a stop or trail sells for"
            stepper={
              v.floor === null ? null : (
                <Stepper
                  label="Never below"
                  value={toCents(v.floor)}
                  min={bottom}
                  max={Math.max(bottom, v.stopLoss === null ? nowCents - 1 : toCents(v.stopLoss))}
                  step={step}
                  format={centsText}
                  onChange={(c) => set({ floor: fromCents(c) })}
                />
              )
            }
          >
            <Chip on={v.floor === null} onPress={() => set({ floor: null })} text="Off" />
            <Chip on={v.floor !== null} onPress={() => set({ floor: floorStart(now) })} text="Set" />
          </Row>
        ) : null}
        <Text
          style={[TYPE.caption, styles.note, { color: problem ? color.down : color.inkMuted }]}
          accessibilityLiveRegion="polite"
        >
          {problem ?? "Sells every share left at the next price. That price decides; nothing sells outside these."}
        </Text>
        <Button
          label={p.pending ? "Setting…" : armed ? "Update exit" : "Set exit"}
          loading={p.pending}
          disabled={p.pending || problem !== null || !hasExit(prices)}
          onPress={() => p.onSet(prices)}
        />
        {armed ? (
          <Button label="Remove exit" variant="ghost" disabled={p.pending} onPress={() => p.onSet(NO_EXIT)} />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SIZE.gutter, gap: SPACE.sm, paddingBottom: SPACE.md },
  row: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: SPACE.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: SIZE.touch - SPACE.xs,
    borderRadius: (SIZE.touch - SPACE.xs) / 2,
    paddingHorizontal: SPACE.md,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { paddingTop: SPACE.xs },
});
