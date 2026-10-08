/**
 * The terminal's top (Tradash phone header, Senryo lanes): the asset chip (real mark, symbol; opens the markets sheet),
 * the balance rolling on the right, and the lane chips — 1m · 5m · 15m · 1h — the selected one carrying the countdown
 * ring to the moment calls close, on the server's clock.
 */
import { CADENCES_SEC, type CadenceSec, LOCKOUT_SEC } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useFont } from "@shopify/react-native-skia";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useSharedValue } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { CountdownRing } from "~/components/kit/CountdownRing";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { ChevronDown } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { TerminalView } from "./useTerminal";

const MARK = 28;
const BALANCE_SIZE = 17;
const BALANCE_HEIGHT = 24;
const BALANCE_WIDTH = 132;
const RING = 18;
const RING_STROKE = 2;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PAD = 2;

export const laneLabel = (c: CadenceSec) =>
  c >= SECONDS_PER_MINUTE * MINUTES_PER_HOUR
    ? `${c / SECONDS_PER_MINUTE / MINUTES_PER_HOUR}h`
    : `${c / SECONDS_PER_MINUTE}m`;
export const clockText = (sec: number) =>
  `${Math.floor(sec / SECONDS_PER_MINUTE)}:${String(Math.max(0, sec % SECONDS_PER_MINUTE)).padStart(PAD, "0")}`;

export function TerminalTop({
  t,
  offsetMs,
  onPickMarket,
}: {
  t: TerminalView;
  offsetMs: SharedValue<number>;
  onPickMarket: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), BALANCE_SIZE);
  const balance = useSharedValue<LiveFigure>({ text: "", trend: 0 });
  const previous = useRef<bigint | undefined>(undefined);
  useEffect(() => {
    if (t.balance === undefined) return;
    const was = previous.current;
    previous.current = t.balance;
    const trend = was === undefined || was === t.balance ? 0 : t.balance > was ? 1 : -1;
    balance.value = { text: `$${formatUnits(t.balance, DOLLAR_DECIMALS, CENTS)}`, trend };
  }, [t.balance, balance]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onPickMarket}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${t.market?.name ?? t.symbol}. Change market`}
        >
          <Animated.View style={[styles.asset, { backgroundColor: color.raised2 }, press.style]}>
            <EntityMark id={marketId(t.symbol)} size={MARK} decorative />
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{t.symbol}</Text>
            <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
          </Animated.View>
        </Pressable>
        <View style={styles.balance}>
          <LiveOdometer
            source={balance}
            font={font}
            color={color.ink}
            height={BALANCE_HEIGHT}
            align="right"
            accessibilityLabel={
              t.balance === undefined ? "Balance" : `Balance $${formatUnits(t.balance, DOLLAR_DECIMALS, CENTS)}`
            }
          />
        </View>
      </View>
      <View style={styles.lanes} accessibilityRole="tablist">
        {CADENCES_SEC.map((c) => {
          const selected = c === t.cadenceSec;
          return (
            <Pressable
              key={c}
              onPress={() => {
                if (selected) return;
                fire("tick");
                t.setCadence(c);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${laneLabel(c)} windows`}
              style={[styles.lane, { backgroundColor: selected ? color.ink : color.raised2 }]}
            >
              {selected ? (
                <CountdownRing
                  fromSec={t.window.start}
                  toSec={t.window.expiry - LOCKOUT_SEC}
                  offsetMs={offsetMs}
                  size={RING}
                  stroke={RING_STROKE}
                  color={color.ground}
                  warn={color.warn}
                  track={color.inkMuted}
                />
              ) : null}
              <Text style={[TYPE.micro, { color: selected ? color.ground : color.ink }]}>{laneLabel(c)}</Text>
              {selected ? (
                <Text style={[TYPE.micro, { color: color.ground }]}>
                  {t.window.trading ? clockText(t.window.closesIn) : clockText(t.window.expiry - t.now)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  asset: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingLeft: SPACE.xs,
    paddingRight: SPACE.md,
    minHeight: SIZE.touch,
    borderRadius: SIZE.touch / 2,
  },
  balance: { width: BALANCE_WIDTH },
  lanes: { flexDirection: "row", gap: SPACE.sm },
  lane: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: SIZE.touch - SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: (SIZE.touch - SPACE.sm) / 2,
  },
});
