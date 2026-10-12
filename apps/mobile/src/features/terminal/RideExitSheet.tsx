/**
 * A ride's exit on the phone (R3.12, R5.5; the web's `RideExitModal`): take-profit and stop as moves from the entry,
 * each with the price it becomes, and the trail's distance behind the best price, flooring at break-even — one
 * signature sets them on chain, where the relay's watcher fires them with the app closed. Stops past the knock-out
 * aren't offered.
 */
import { RIDE_EXIT_MOVES_BPS, RIDE_TRAIL_STEPS_BPS, trailText, unitOf } from "@senryo/calls";
import { priceText, type RideExitLevels } from "@senryo/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const BPS = 10_000n;

const at = (entry: bigint, bps: number, up: boolean) => (entry * (BPS + (up ? 1n : -1n) * BigInt(bps))) / BPS;

function Choice({
  title,
  items,
  chosen,
  onPick,
}: {
  title: string;
  items: readonly { key: number; text: string; sub: string }[];
  chosen: number | null;
  onPick: (k: number | null) => void;
}) {
  const { color } = useTheme();
  const chip = (key: number | null, text: string, sub: string | null) => {
    const on = key === chosen;
    return (
      <Pressable
        key={String(key)}
        onPress={() => {
          fire("tick");
          onPick(key);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={sub ? `${title} ${text}, ${sub}` : `${title} off`}
        style={[styles.chip, { backgroundColor: on ? color.ink : color.raised2 }]}
      >
        <Text style={[TYPE.chipLabel, { color: on ? color.ground : color.ink }]}>{text}</Text>
        {sub ? <Text style={[TYPE.micro, { color: on ? color.ground : color.text3 }]}>{sub}</Text> : null}
      </Pressable>
    );
  };
  return (
    <View style={styles.section}>
      <Text style={[TYPE.micro, styles.title, { color: color.text3 }]}>{title.toUpperCase()}</Text>
      <View style={styles.chips}>
        {chip(null, "Off", null)}
        {items.map((i) => chip(i.key, i.text, i.sub))}
      </View>
    </View>
  );
}

export function RideExitSheet(p: {
  symbol: string;
  isLong: boolean;
  entryE8: bigint;
  koE8: bigint;
  breakEvenE8: bigint;
  exit: RideExitLevels | null;
  pending: boolean;
  onSet: (levels: RideExitLevels) => void;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const unit = unitOf(p.symbol);
  const pickOf = (e8: bigint | undefined, profitSide: boolean) =>
    e8 && e8 > 0n ? (RIDE_EXIT_MOVES_BPS.find((b) => at(p.entryE8, b, profitSide === p.isLong) === e8) ?? null) : null;
  const [tp, setTp] = useState<number | null>(pickOf(p.exit?.takeProfitE8, true));
  const [sl, setSl] = useState<number | null>(pickOf(p.exit?.stopLossE8, false));
  const [trail, setTrail] = useState<number | null>(p.exit && p.exit.trailBps > 0 ? p.exit.trailBps : null);
  const pastKo = (bps: number) => {
    const price = at(p.entryE8, bps, !p.isLong);
    return p.isLong ? price <= p.koE8 : price >= p.koE8;
  };
  const armed = p.exit !== null && (p.exit.takeProfitE8 > 0n || p.exit.stopLossE8 > 0n || p.exit.trailBps > 0);
  const levels: RideExitLevels = {
    takeProfitE8: tp === null ? 0n : at(p.entryE8, tp, p.isLong),
    stopLossE8: sl === null ? 0n : at(p.entryE8, sl, !p.isLong),
    floorE8: trail === null ? 0n : p.breakEvenE8,
    trailBps: trail ?? 0,
  };
  return (
    <Sheet onClose={p.onClose} closeLabel="Close the exit">
      <SheetHeading title={`${p.symbol} · Exit`} body="It runs on chain with the app closed" />
      <View style={styles.body}>
        <Choice
          title="Take profit"
          items={RIDE_EXIT_MOVES_BPS.map((b) => ({
            key: b,
            text: `+${trailText(b)}`,
            sub: priceText(at(p.entryE8, b, p.isLong), unit),
          }))}
          chosen={tp}
          onPick={setTp}
        />
        <Choice
          title="Stop"
          items={RIDE_EXIT_MOVES_BPS.filter((b) => !pastKo(b)).map((b) => ({
            key: b,
            text: `−${trailText(b)}`,
            sub: priceText(at(p.entryE8, b, !p.isLong), unit),
          }))}
          chosen={sl}
          onPick={setSl}
        />
        <Choice
          title="Trailing stop"
          items={RIDE_TRAIL_STEPS_BPS.map((b) => ({ key: b, text: trailText(b), sub: "behind best" }))}
          chosen={trail}
          onPick={setTrail}
        />
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          Knocked out at {priceText(p.koE8, unit)} whatever the exit says.
        </Text>
        <Button
          label={p.pending ? "Setting…" : armed ? "Update exit" : "Set exit"}
          disabled={p.pending || (!armed && tp === null && sl === null && trail === null)}
          onPress={() => p.onSet(levels)}
        />
        {armed ? (
          <Button
            label="Remove exit"
            variant="ghost"
            disabled={p.pending}
            onPress={() => p.onSet({ takeProfitE8: 0n, stopLossE8: 0n, floorE8: 0n, trailBps: 0 })}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.lg, paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg },
  section: { gap: SPACE.sm },
  title: { letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: SIZE.chipHeight + SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: SPACE.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
