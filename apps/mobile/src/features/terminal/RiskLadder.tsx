/**
 * The ride's risk, drawn (Q1, Codex direction 16 §1; `@senryo/calls` `rideLadder`): two rails on one rising price
 * axis — UP on the left, DOWN on the right — each from its knock-out (a broken crossbar) to its cap (a solid tick),
 * the live price dashed across both. Distances are true: more leverage visibly brings the knock-out in. A tap on a
 * level shows how far it is; its price shows otherwise. Each level is written once, nowhere else on the sheet.
 */
import { type LadderLevel, type RideLadder, unitOf } from "@senryo/calls";
import { priceText } from "@senryo/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { fire } from "~/feedback/fire";
import { SPACE, TYPE, useTheme } from "~/theme";

export const LADDER_HEIGHT = 192;
const RAIL = 10;
const TICK = 28;
const UP_X = 0.36;
const DOWN_X = 0.64;
const DASH_LEN = 4;
const DASH = [DASH_LEN, DASH_LEN];
const HALF = 2;
const LABEL_H = 18;
const PERCENT_PER_BPS = 100;
const ONE_DECIMAL = 1;
const BAND_ALPHA = 0.28;
const CAP_STROKE = 3;
const KO_STROKE = 2;

const moveText = (bps: number) => `${bps < 0 ? "−" : "+"}${Math.abs(bps / PERCENT_PER_BPS).toFixed(ONE_DECIMAL)}%`;

export function RiskLadder({ ladder, symbol, markE8 }: { ladder: RideLadder; symbol: string; markE8: bigint }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const unit = unitOf(symbol);
  const y = (at: number) => (1 - at) * LADDER_HEIGHT;
  const railX = (side: "up" | "down") => width * (side === "up" ? UP_X : DOWN_X);
  const band = (side: "up" | "down") => {
    const [lo, hi] = ladder.bands[side];
    return { top: y(hi), height: Math.max(1, y(lo) - y(hi)) };
  };
  const label = (l: LadderLevel) => {
    const key = `${l.side}-${l.kind}`;
    const words = `${l.kind === "ko" ? "KO" : "Cap"} ${open === key ? moveText(l.moveBps) : priceText(l.priceE8, unit)}`;
    const left = l.side === "up";
    return (
      <Pressable
        key={key}
        onPress={() => {
          fire("tick");
          setOpen((o) => (o === key ? null : key));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${l.side === "up" ? "Up" : "Down"} ${l.kind === "ko" ? "knocks out" : "caps"} at ${priceText(l.priceE8, unit)}, ${moveText(l.moveBps)}`}
        hitSlop={SPACE.sm}
        style={[
          styles.label,
          { top: y(l.at) - LABEL_H / HALF },
          left
            ? { right: width - railX("up") + TICK / HALF + SPACE.xs }
            : { left: railX("down") + TICK / HALF + SPACE.xs },
        ]}
      >
        <Text numberOfLines={1} style={[TYPE.chipLabel, { color: l.kind === "ko" ? color.ink : color.inkMuted }]}>
          {words}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={LADDER_HEIGHT}>
            {(["up", "down"] as const).map((side) => {
              const b = band(side);
              return (
                <Rect
                  key={side}
                  x={railX(side) - RAIL / HALF}
                  y={b.top}
                  width={RAIL}
                  height={b.height}
                  rx={RAIL / HALF}
                  fill={side === "up" ? color.up : color.down}
                  opacity={BAND_ALPHA}
                />
              );
            })}
            {ladder.levels.map((l) => {
              const cx = railX(l.side);
              return (
                <Line
                  key={`${l.side}-${l.kind}`}
                  x1={cx - TICK / HALF}
                  x2={cx + TICK / HALF}
                  y1={y(l.at)}
                  y2={y(l.at)}
                  stroke={color.ink}
                  strokeWidth={l.kind === "cap" ? CAP_STROKE : KO_STROKE}
                  {...(l.kind === "ko" ? { strokeDasharray: DASH } : {})}
                />
              );
            })}
            <Line
              x1={0}
              x2={width}
              y1={y(ladder.markAt)}
              y2={y(ladder.markAt)}
              stroke={color.inkMuted}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          </Svg>
          {ladder.levels.map(label)}
          <Text style={[TYPE.chipLabel, styles.side, { left: railX("up") - TICK, color: color.up }]}>UP ↑</Text>
          <Text style={[TYPE.chipLabel, styles.side, { left: railX("down") - TICK / HALF, color: color.down }]}>
            DOWN ↓
          </Text>
          <View style={[styles.now, { top: y(ladder.markAt) - LABEL_H / HALF, backgroundColor: color.ground }]}>
            <Text style={[TYPE.chipLabel, { color: color.ink }]}>{priceText(markE8, unit)}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: LADDER_HEIGHT, marginTop: SPACE.lg },
  label: { position: "absolute", height: LABEL_H, justifyContent: "center" },
  side: { position: "absolute", top: -SPACE.lg },
  now: {
    position: "absolute",
    alignSelf: "center",
    height: LABEL_H,
    paddingHorizontal: SPACE.xs,
    justifyContent: "center",
  },
});
