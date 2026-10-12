/**
 * The terminal's top (Tradash phone header, Senryo lanes): the asset chip (real mark, symbol; opens the markets sheet),
 * equity rolling on the right (Tradash's pill: cash + every open position's live value, R5.3), and the lane chips — 1m · 5m · 15m · 1h — the selected one carrying the countdown
 * ring to the moment calls close, on the server's clock.
 */

import { endsText } from "@senryo/calls";
import { useDayLine, useLiveBook, useWindowDead } from "@senryo/calls/react";
import { CADENCES_SEC, LOCKOUT_SEC } from "@senryo/config";
import { clockText, formatUnits, laneLabel } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useFont } from "@shopify/react-native-skia";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useSharedValue } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChangeChip } from "~/components/kit/ChangeChip";
import { CountdownRing } from "~/components/kit/CountdownRing";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { Sparkline } from "~/components/kit/Sparkline";
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

export function TerminalTop({
  t,
  offsetMs,
  ride = false,
  rideEndsIn = null,
  onPickMarket,
}: {
  t: TerminalView;
  offsetMs: SharedValue<number>;
  /** On Ride the lanes give way to the held ride's life left ("Closes in 3:42:18"), if any. */
  ride?: boolean;
  rideEndsIn?: string | null;
  onPickMarket: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const day = useDayLine(t.symbol);
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), BALANCE_SIZE);
  const book = useLiveBook();
  // R5.25: a long lane nobody opened in time takes no calls this window — its chip names when the next opens.
  const dead = useWindowDead(t);
  // Cash until the book has loaded, then cash + what every open position returns now.
  const equity = book.ready ? (book.totals.equity ?? undefined) : t.balance;
  const balance = useSharedValue<LiveFigure>({ text: "", trend: 0 });
  const previous = useRef<bigint | undefined>(undefined);
  useEffect(() => {
    if (equity === undefined) return;
    const was = previous.current;
    previous.current = equity;
    const trend = was === undefined || was === equity ? 0 : equity > was ? 1 : -1;
    balance.value = { text: `$${formatUnits(equity, DOLLAR_DECIMALS, CENTS)}`, trend };
  }, [equity, balance]);

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
        {day ? (
          <View style={styles.day} accessibilityLabel="The last 24 hours">
            <Sparkline symbol={t.symbol} day={day} />
            <ChangeChip symbol={t.symbol} day={day} />
          </View>
        ) : null}
        <View style={styles.balance}>
          <LiveOdometer
            source={balance}
            font={font}
            color={color.ink}
            height={BALANCE_HEIGHT}
            align="right"
            sensitive
            accessibilityLabel={
              equity === undefined ? "Equity" : `Equity $${formatUnits(equity, DOLLAR_DECIMALS, CENTS)}`
            }
          />
        </View>
      </View>
      {ride ? (
        <Text style={[TYPE.caption, styles.life, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
          {rideEndsIn ?? "Up to 4 h a ride · no funding"}
        </Text>
      ) : (
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
                    {dead
                      ? `Next ${endsText(t.window.expiry)}`
                      : t.window.trading
                        ? clockText(t.window.closesIn)
                        : clockText(t.window.expiry - t.now)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
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
  life: { minHeight: SIZE.touch - SPACE.sm, textAlignVertical: "center", paddingTop: SPACE.xs },
  lane: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: SIZE.touch - SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: (SIZE.touch - SPACE.sm) / 2,
  },
});
