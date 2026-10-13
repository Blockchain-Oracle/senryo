/**
 * Ride settings on the phone (Q1, D-344, Codex direction 16 §1; the owner's review): the margin on one line (the
 * keypad opens on a tap); Leverage — off, so the ride is 1×, until switched on, when one big multiple and a slider
 * over the market's marks appear; the risk drawn as a ladder (each side's knock-out and cap at their true distance);
 * the trail and the fee each one line that opens. Nothing repeated, nothing explained in a sentence.
 */
import {
  dollars,
  feeDollars,
  LEVERAGE_OFF_X,
  leverageMarks,
  leverageOn,
  RIDE_MARGIN_USD,
  RIDE_TRAIL_STEPS_BPS,
  type RideTermsLike,
  rideLadder,
  rideQuote,
  trailText,
} from "@senryo/calls";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountPad } from "~/components/kit/AmountPad";
import { DisclosureRow } from "~/components/kit/DisclosureRow";
import { FactList } from "~/components/kit/FactList";
import { MarksSlider } from "~/components/kit/MarksSlider";
import { Switch } from "~/components/kit/Switch";
import { SquarePen } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { Chips, chipsOf, useTyped } from "./order-parts";
import { RiskLadder } from "./RiskLadder";

const ONE_X = 10_000;
const ROW = 56;
const BPS_PER_PERCENT = 100;

export interface RideOrder {
  symbol: string;
  markE8: bigint | null;
  margin: bigint;
  leverageBps: number;
  maxLeverageBps: number;
  /** The multiple leverage returns to when it's switched back on. */
  leverageOnX: number;
  trailBps: number;
  terms: RideTermsLike & { minMargin: bigint; maxMargin: bigint; earlyFeeBps: number; earlyWindowSec: number };
  onMargin: (v: bigint) => void;
  onLeverage: (x: number) => void;
  onTrail: (bps: number) => void;
}

export function RideSettingsBody({ o, available }: { o: RideOrder; available: bigint | undefined }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const [editing, setEditing] = useState(false);
  const money = (v: bigint) => masked(dollars(v), hidden);
  const fine = (v: bigint) => masked(feeDollars(v), hidden);
  const amount = useTyped(o.margin, o.terms.minMargin, o.terms.maxMargin, available, o.onMargin);
  const on = leverageOn(o.leverageBps);
  const x = o.leverageBps / ONE_X;
  const marks = leverageMarks(o.maxLeverageBps);
  const up = o.markE8 ? rideQuote(true, o.margin, o.leverageBps, o.markE8, o.terms) : null;
  const down = o.markE8 ? rideQuote(false, o.margin, o.leverageBps, o.markE8, o.terms) : null;
  const ladder = up && down && o.markE8 ? rideLadder(up, down, o.markE8) : null;
  // Off is always one tap; on returns to the multiple last chosen, held to this market's cap (D-344).
  const toggle = (next: boolean) =>
    o.onLeverage(next ? Math.min(o.leverageOnX, marks.at(-1) ?? o.leverageOnX) : LEVERAGE_OFF_X);
  return (
    <>
      <Pressable
        onPress={() => {
          fire("tick");
          setEditing((e) => !e);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: editing }}
        accessibilityLabel={`Margin ${money(o.margin)}. Edit`}
        style={styles.row}
      >
        <Text style={[TYPE.row, styles.grow, { color: color.ink }]}>Margin</Text>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{money(o.margin)}</Text>
        <SquarePen size={SIZE.iconSm} color={color.inkMuted} />
      </Pressable>
      {editing ? (
        <AmountPad
          label="Margin"
          value={amount.typed}
          chips={chipsOf(RIDE_MARGIN_USD, o.terms.maxMargin, available)}
          {...(available === undefined ? {} : { note: `Available ${money(available)}` })}
          problem={amount.problem}
          onChange={amount.change}
        />
      ) : null}
      <Pressable
        onPress={() => {
          fire("tick", { cue: "toggle" });
          toggle(!on);
        }}
        accessibilityRole="switch"
        accessibilityLabel="Leverage"
        accessibilityState={{ checked: on }}
        accessible
        style={styles.row}
      >
        <Text style={[TYPE.row, styles.grow, { color: color.ink }]}>Leverage</Text>
        <Switch value={on} onValueChange={toggle} accessibilityLabel="Leverage" />
      </Pressable>
      {on ? (
        <View style={styles.leverage}>
          <Text style={[TYPE.displayBalance, { color: color.ink }]}>{x}×</Text>
          <MarksSlider
            marks={marks}
            value={marks.includes(x) ? x : (marks[0] ?? x)}
            onChange={o.onLeverage}
            format={(v) => `${v}×`}
            label="Leverage"
          />
        </View>
      ) : null}
      {ladder && o.markE8 ? <RiskLadder ladder={ladder} symbol={o.symbol} markE8={o.markE8} /> : null}
      <DisclosureRow title="Trail" value={trailText(o.trailBps)}>
        <Chips
          items={RIDE_TRAIL_STEPS_BPS.map((b) => ({ key: String(b), label: trailText(b) }))}
          chosen={String(o.trailBps)}
          onPick={(k) => o.onTrail(Number(k))}
        />
      </DisclosureRow>
      {up ? (
        <DisclosureRow title="Open fee" value={fine(up.fee)}>
          <FactList
            facts={[
              { label: "Close fee at today's price", value: feeDollars(up.closeFee), money: true },
              ...(o.terms.earlyFeeBps > 0
                ? [
                    {
                      label: `In profit within ${o.terms.earlyWindowSec} s`,
                      value: `up to ${o.terms.earlyFeeBps / BPS_PER_PERCENT}%`,
                    },
                  ]
                : []),
            ]}
          />
        </DisclosureRow>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: ROW },
  grow: { flex: 1 },
  leverage: { gap: SPACE.xs },
});
