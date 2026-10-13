/**
 * What a call pays, drawn (Q1, Codex direction 16 §2; `@senryo/calls` `callPayoff`): the line across a rising price
 * axis, each side's winning zone tinted where its edges sit, and in each zone a pay bar on one shared scale — a bigger
 * stake grows them; the dashed tick is the stake, so the bar past it is the profit. A tap on a zone shows where it
 * wins in place of its name. With balances hidden the bars keep only their odds (no stake tick, no amounts).
 */
import type { CallPayoff, PayoffZone } from "@senryo/calls";
import { dollars, unitOf } from "@senryo/calls";
import { priceText } from "@senryo/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { fire } from "~/feedback/fire";
import { masked } from "~/lib/hide-balances";
import { SPACE, TYPE, useTheme } from "~/theme";

export const PAYOFF_HEIGHT = 216;
const GUTTER = 88;
const BAR = 28;
const HALF = 2;
const DASH_LEN = 4;
const DASH = [DASH_LEN, DASH_LEN];
const INSIDE = 0.72;
const LABEL_H = 18;
const UNPRICED_ALPHA = 0.3;

export function PayoffDrawing({
  payoff,
  lineE8,
  symbol,
  hidden,
}: {
  payoff: CallPayoff;
  lineE8: bigint | undefined;
  symbol: string;
  hidden: boolean;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const span = Math.max(0, width - GUTTER);
  const y = (at: number) => (1 - at) * PAYOFF_HEIGHT;
  const most = payoff.zones.reduce((m, z) => (z.payout !== null && z.payout > m ? z.payout : m), 0n);
  const share = (z: PayoffZone) =>
    hidden ? (z.payout !== null && most > 0n ? Number(z.payout) / Number(most) : 0) : z.bar;
  const tone = (z: PayoffZone) =>
    z.band.tone === "up" ? color.up : z.band.tone === "down" ? color.down : color.primary;
  const wash = (z: PayoffZone) =>
    z.band.tone === "up" ? color.upWash : z.band.tone === "down" ? color.downWash : color.primaryWash;
  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={PAYOFF_HEIGHT}>
            {payoff.zones.map((z) => (
              <Rect
                key={`zone-${z.slot}`}
                x={0}
                y={y(z.to)}
                width={width}
                height={y(z.from) - y(z.to)}
                fill={wash(z)}
              />
            ))}
            {payoff.zones.map((z) => {
              const mid = (y(z.from) + y(z.to)) / HALF;
              return (
                <Rect
                  key={`bar-${z.slot}`}
                  x={GUTTER}
                  y={mid - BAR / HALF}
                  width={Math.max(BAR / HALF, share(z) * span)}
                  height={BAR}
                  rx={BAR / HALF}
                  fill={tone(z)}
                  opacity={z.payout === null ? UNPRICED_ALPHA : 1}
                />
              );
            })}
            <Line
              x1={0}
              x2={width}
              y1={y(payoff.lineAt)}
              y2={y(payoff.lineAt)}
              stroke={color.ink}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
            {hidden ? null : (
              <Line
                x1={GUTTER + payoff.stakeBar * span}
                x2={GUTTER + payoff.stakeBar * span}
                y1={0}
                y2={PAYOFF_HEIGHT}
                stroke={color.inkMuted}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
            )}
          </Svg>
          {payoff.zones.map((z) => {
            const mid = (y(z.from) + y(z.to)) / HALF;
            const pays = z.payout === null ? "—" : masked(dollars(z.payout), hidden);
            const end = GUTTER + Math.max(BAR / HALF, share(z) * span);
            const inside = share(z) > INSIDE;
            return (
              <Pressable
                key={`hit-${z.slot}`}
                onPress={() => {
                  fire("tick");
                  setOpen((o) => (o === z.slot ? null : z.slot));
                }}
                accessibilityRole="button"
                accessibilityLabel={`${z.band.label} pays ${pays} if ${z.band.where}`}
                style={[styles.zone, { top: y(z.to), height: y(z.from) - y(z.to) }]}
              >
                <Text
                  numberOfLines={2}
                  style={[TYPE.rowStrong, styles.name, { top: mid - y(z.to) - LABEL_H / HALF, color: tone(z) }]}
                >
                  {open === z.slot ? z.band.where : z.band.label}
                </Text>
                <Text
                  style={[
                    TYPE.rowAmount,
                    styles.pays,
                    { top: mid - y(z.to) - LABEL_H / HALF },
                    inside
                      ? { right: width - end + SPACE.sm, color: color.ground }
                      : { left: end + SPACE.sm, color: color.ink },
                  ]}
                >
                  {pays}
                </Text>
              </Pressable>
            );
          })}
          {lineE8 !== undefined ? (
            <View style={[styles.line, { top: y(payoff.lineAt) - LABEL_H / HALF, backgroundColor: color.ground }]}>
              <Text style={[TYPE.chipLabel, { color: color.ink }]}>{priceText(lineE8, unitOf(symbol))}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: PAYOFF_HEIGHT },
  zone: { position: "absolute", left: 0, right: 0 },
  name: { position: "absolute", left: 0, width: GUTTER - SPACE.sm },
  pays: { position: "absolute", height: LABEL_H },
  line: { position: "absolute", right: 0, height: LABEL_H, paddingHorizontal: SPACE.xs, justifyContent: "center" },
});
