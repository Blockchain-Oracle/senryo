/**
 * The parlay slip (S8.5; the web's `ParlaySlip`): each leg with its window's countdown and both sides' odds (the 21st
 * Odds Display port, the picked side pressed, an arrow when it moved since the pick), the stake, what it pays and how
 * likely, and Place — one-tap or one Face ID. Two to four legs; why it can't be placed, in words.
 */
import {
  chanceText,
  multiplierText,
  PARLAY_SIDES,
  PARLAY_STAKES_USD,
  type ParlayPick,
  pickLine,
  sideOdds,
} from "@senryo/calls";
import type { ParlayQuoteView } from "@senryo/calls/react";
import { PARLAY } from "@senryo/config";
import { clockText, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { OddsButton } from "~/components/kit/OddsButton";
import { X } from "~/components/kit/symbols";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 32;
const USD = 1_000_000n;

export function ParlaySlipSheet(p: {
  quote: ParlayQuoteView;
  halfSpreadE6: number;
  stake: bigint;
  onStake: (stake: bigint) => void;
  onPick: (pick: ParlayPick) => void;
  onRemove: (symbol: string) => void;
  onPlace: () => void;
  pending: string | null;
  balance: bigint | undefined;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const firstOdds = useRef(new Map<string, number | null>());
  const legs = p.quote.legs;
  const q = p.quote.quote;
  const why =
    legs.length < PARLAY.minLegs
      ? `Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls`
      : !p.quote.trading
        ? "A leg's window is closing — pick its next one"
        : q?.refusal
          ? "Not priced right now: a leg is out of range"
          : p.balance !== undefined && p.balance < p.stake
            ? "Not enough dollars for this stake"
            : null;
  return (
    <Sheet onClose={p.onClose} closeLabel="Close the slip">
      <SheetHeading title="Your parlay" body="All must come true; the odds multiply" />
      <View style={styles.body}>
        {legs.map((l) => (
          <View key={l.pick.symbol} style={styles.leg}>
            <EntityMark id={marketId(l.pick.symbol)} size={MARK} decorative />
            <View style={styles.flex}>
              <Text style={[TYPE.rowTitle, { color: color.ink }]}>{pickLine(l.pick)}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>Closes in {clockText(l.window.closesIn)}</Text>
            </View>
            {PARLAY_SIDES.map((side, i) => {
              const odds = sideOdds(l.sides[i] ?? null, p.halfSpreadE6);
              const key = `${l.pick.symbol}:${l.pick.cadenceSec}:${side.band}`;
              if (!firstOdds.current.has(key) && odds !== null) firstOdds.current.set(key, odds);
              return (
                <OddsButton
                  key={side.band}
                  label={side.label}
                  odds={odds}
                  previousOdds={firstOdds.current.get(key)}
                  selected={l.pick.band === side.band}
                  onPress={() => l.pick.band !== side.band && p.onPick({ ...l.pick, band: side.band })}
                  accessibilityLabel={`${l.pick.symbol} ${side.label}`}
                />
              );
            })}
            <Pressable
              onPress={() => p.onRemove(l.pick.symbol)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${l.pick.symbol}`}
              hitSlop={SPACE.sm}
            >
              <X size={SIZE.iconSm} color={color.inkMuted} />
            </Pressable>
          </View>
        ))}
        <View style={styles.stakes} accessibilityRole="radiogroup" accessibilityLabel="Stake">
          {PARLAY_STAKES_USD.map((d) => {
            const value = BigInt(d) * USD;
            const on = p.stake === value;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  fire("tick");
                  p.onStake(value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`$${d}`}
                style={[styles.stake, { backgroundColor: on ? color.ink : color.raised2 }]}
              >
                <Text style={[TYPE.rowTitle, { color: on ? color.ground : color.ink }]}>${d}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.summary}>
          <Text style={[TYPE.sectionTitle, { color: color.ink }]}>
            {q && !q.refusal ? `Pays ${usd(q.payout)}` : "—"}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {q && !q.refusal ? `${multiplierText(p.stake, q.payout)} · ${chanceText(q.chanceE6)}` : ""}
          </Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
          {p.pending ?? why ?? "One wrong call and the stake is the pool's."}
        </Text>
        <Button
          label={`Place parlay · ${usd(p.stake)}`}
          loading={p.pending !== null}
          disabled={why !== null || p.pending !== null}
          onPress={p.onPlace}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SIZE.gutter, gap: SPACE.md, paddingBottom: SPACE.md },
  leg: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  stakes: { flexDirection: "row", gap: SPACE.sm },
  stake: {
    flex: 1,
    minHeight: SIZE.touch - SPACE.xs,
    borderRadius: (SIZE.touch - SPACE.xs) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
});
