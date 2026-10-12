/**
 * A market on Parlay's board (P3, D-326; Codex's 140-point card): the real mark, symbol and name, the live price with
 * its 24 h line and change, and two 44-point sides — "↑ Up · 1.89×", "↓ Down · 1.94×" — priced for the selected lane
 * (`useLegPrices` → `indicativeOdds`: indicative, the slip's price is the chain's). Tap a side to pick it, again to
 * drop it, the other side to switch. The mark is where a new leg's flight starts (`FlyLayer`).
 */
import { indicativeOdds, PARLAY_SIDES, unitOf } from "@senryo/calls";
import { useDayLine, useLegPrices } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChangeChip } from "~/components/kit/ChangeChip";
import { Sparkline } from "~/components/kit/Sparkline";
import { ArrowDown, ArrowUp } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { DISABLED_OPACITY, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatValue, priceDecimals } from "../terminal/chart/engine";

export const CARD_MARK = 32;
const E8 = 1e8;
const ODDS_DECIMALS = 2;
const ARROW = 14;

export interface MarkBox {
  x: number;
  y: number;
  size: number;
}

export function ParlayCard({
  symbol,
  name,
  cadenceSec,
  minHalfSpreadE6,
  pickedBand,
  onPick,
}: {
  symbol: string;
  name: string;
  cadenceSec: CadenceSec;
  minHalfSpreadE6: number;
  /** The side picked on this market, if any. */
  pickedBand: number | undefined;
  /** A side tapped, with where the mark sits on screen (for the flight). */
  onPick: (band: number, from: MarkBox | null) => void;
}) {
  const { color } = useTheme();
  const mark = useRef<View>(null);
  const priceE8 = useLivePrice(symbol);
  const day = useDayLine(symbol);
  const leg = useLegPrices([{ symbol, cadenceSec }]).legs[0];
  const points = unitOf(symbol) === "points";
  const price = priceE8 ? formatValue(priceE8 / E8, priceDecimals(priceE8 / E8), points) : "—";
  const tap = (band: number) => {
    const node = mark.current;
    if (!node) return onPick(band, null);
    node.measureInWindow((x, y, w) => onPick(band, { x, y, size: w }));
  };
  return (
    <View style={[styles.card, { backgroundColor: color.card }]}>
      <View style={styles.top}>
        <View ref={mark} collapsable={false}>
          <EntityMark id={marketId(symbol)} size={CARD_MARK} decorative />
        </View>
        <View style={styles.names}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}</Text>
          <Text numberOfLines={1} style={[TYPE.caption, { color: color.inkMuted }]}>
            {name}
          </Text>
        </View>
        {day ? <Sparkline symbol={symbol} day={day} /> : null}
        <View style={styles.figures}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{price}</Text>
          {day ? <ChangeChip symbol={symbol} day={day} /> : null}
        </View>
      </View>
      <View style={styles.sides}>
        {PARLAY_SIDES.map((side) => {
          // Between rounds the closing window's odds mean nothing for the next: no odds, the side picks a draft.
          const between = leg !== undefined && !leg.window.trading;
          const odds =
            leg && !between ? indicativeOdds(leg.sides[side.band] ?? null, minHalfSpreadE6, cadenceSec) : null;
          return (
            <SideButton
              key={side.band}
              symbol={symbol}
              band={side.band}
              label={side.label}
              odds={odds}
              between={between}
              on={pickedBand === side.band}
              onPress={() => tap(side.band)}
            />
          );
        })}
      </View>
    </View>
  );
}

function SideButton(p: {
  symbol: string;
  band: number;
  label: string;
  odds: number | null;
  /** Between rounds: no odds, still pickable (a draft for the next round). */
  between: boolean;
  on: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const up = p.band === 0;
  const tone = up ? color.up : color.down;
  const ink = p.on ? (up ? color.upForeground : color.downForeground) : color.ink;
  const shown = p.odds === null ? "—" : `${p.odds.toFixed(ODDS_DECIMALS)}×`;
  const Arrow = up ? ArrowUp : ArrowDown;
  const off = p.odds === null && !p.on && !p.between;
  return (
    <Pressable
      disabled={off}
      onPress={p.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: p.on, disabled: off }}
      accessibilityLabel={`${p.on ? "Remove" : "Add"} ${p.symbol} ${p.label}${p.between ? ", for the next round" : p.odds === null ? ", not priced" : `, pays about ${p.odds.toFixed(ODDS_DECIMALS)} times`}`}
      style={styles.flex}
    >
      <View
        style={[styles.side, { backgroundColor: p.on ? tone : color.raised2, opacity: off ? DISABLED_OPACITY : 1 }]}
      >
        <Arrow size={ARROW} color={p.on ? ink : tone} strokeWidth={2.5} />
        <Text style={[TYPE.buttonCompact, { color: ink }]}>{p.between ? p.label : `${p.label} · ${shown}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.md },
  top: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  names: { flex: 1 },
  figures: { alignItems: "flex-end", gap: SPACE.xxs },
  sides: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
  side: {
    minHeight: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
  },
});
