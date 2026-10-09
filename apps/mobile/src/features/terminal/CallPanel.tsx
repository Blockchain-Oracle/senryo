/**
 * The call panel (Tradash's UP/DOWN ↔ CLOSE, Senryo's windows): the stake (last one remembered; $1 · $5 · $10 · $25 ·
 * Max), then UP and DOWN each with its live odds ("pays 1.92× · about 52%"), or — holding a call in this window — one
 * CLOSE with the cash-out value rolling. Honest states: calls closed for the lockout, a stale price, a call in flight.
 */
import type { MarketLine } from "@senryo/calls";
import type { PanelState } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useFont } from "@shopify/react-native-skia";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { LiveText } from "~/components/kit/LiveText";
import { ArrowDownUp } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { STAKE_PRESETS_USD } from "./constants";
import { OneTapLine } from "./OneTapLine";

const USD = 1_000_000n;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;
const BUTTON_H = 64;
const CASH_SIZE = 20;
const CASH_HEIGHT = 26;
const CASH_WIDTH = 120;

export type { PanelState } from "@senryo/calls/react";

function CallButton({
  label,
  tone,
  odds,
  disabled,
  onPress,
}: {
  label: string;
  tone: string;
  odds: SharedValue<string>;
  disabled: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      style={styles.flex}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Call ${label}`}
      accessibilityState={{ disabled }}
    >
      <Animated.View
        style={[styles.call, { backgroundColor: tone, opacity: disabled ? DISABLED_OPACITY : 1 }, press.style]}
      >
        <Text style={[TYPE.buttonLabel, { color: color.paperInk }]}>{label}</Text>
        <LiveText text={odds} style={[TYPE.micro, { color: color.paperInk }]} />
      </Animated.View>
    </Pressable>
  );
}

/** A market outside its session (D-289): no new calls until it opens; the chart shows the last print. */
function ClosedPanel({ symbol, when }: { symbol: string; when: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{symbol} is closed</Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{when}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        The price shown is its last print. Calls open with the market.
      </Text>
    </View>
  );
}

export function CallPanel(props: Parameters<typeof OpenPanel>[0] & { symbol: string; session: MarketLine }) {
  if (!props.session.trading && !props.holding) return <ClosedPanel symbol={props.symbol} when={props.session.text} />;
  return <OpenPanel {...props} />;
}

function OpenPanel({
  state,
  stake,
  balance,
  onStake,
  upOdds,
  downOdds,
  holding,
  cashOut,
  onUp,
  onDown,
  onClose,
  onCustom,
  onClosePart,
}: {
  state: PanelState;
  stake: bigint;
  balance: bigint | undefined;
  onStake: (stake: bigint) => void;
  upOdds: SharedValue<string>;
  downOdds: SharedValue<string>;
  holding: boolean;
  cashOut: SharedValue<LiveFigure>;
  onUp: () => void;
  onDown: () => void;
  onClose: () => void;
  /** The keypad for any other stake. */
  onCustom: () => void;
  /** Long-press on Cash out: a part of the call (25 / 50 / 100 %). */
  onClosePart: () => void;
}) {
  const { color } = useTheme();
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), CASH_SIZE);
  const closePress = usePressScale();
  const blocked = state.kind !== "ready";
  const presets = STAKE_PRESETS_USD.map((usd) => BigInt(usd) * USD);
  const custom = !presets.includes(stake) && !(balance !== undefined && stake === balance);
  const notice =
    state.kind === "pending"
      ? state.label
      : state.kind === "locked"
        ? state.text
        : state.kind === "stale"
          ? "Reconnecting · price paused"
          : state.kind === "no-price"
            ? "Waiting for the opening price"
            : null;

  return (
    <View style={styles.wrap}>
      {holding ? null : (
        <View style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel="Stake">
          {STAKE_PRESETS_USD.map((usd) => {
            const value = BigInt(usd) * USD;
            const selected = value === stake;
            return (
              <Pressable
                key={usd}
                onPress={() => {
                  fire("tick");
                  onStake(value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`$${usd}`}
                style={[styles.preset, { backgroundColor: selected ? color.ink : color.raised2 }]}
              >
                <Text style={[TYPE.rowTitle, { color: selected ? color.ground : color.ink }]}>${usd}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              fire("tick");
              onCustom();
            }}
            accessibilityRole="button"
            accessibilityLabel={custom ? `Stake ${dollars(stake)}. Change` : "Other stake"}
            style={[styles.preset, { backgroundColor: custom ? color.ink : color.raised2 }]}
          >
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[TYPE.rowTitle, { color: custom ? color.ground : color.ink }]}
            >
              {custom ? dollars(stake) : "···"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (balance === undefined) return;
              fire("tick");
              onStake(balance);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: balance !== undefined && stake === balance }}
            accessibilityLabel="Max"
            style={[
              styles.preset,
              { backgroundColor: balance !== undefined && stake === balance ? color.ink : color.raised2 },
            ]}
          >
            <Text
              style={[TYPE.rowTitle, { color: balance !== undefined && stake === balance ? color.ground : color.ink }]}
            >
              Max
            </Text>
          </Pressable>
        </View>
      )}
      {notice ? (
        <Text style={[TYPE.caption, styles.notice, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : (
        <OneTapLine />
      )}
      {holding ? (
        <Pressable
          onPress={onClose}
          onLongPress={() => {
            fire("snap");
            onClosePart();
          }}
          accessibilityHint="Hold to cash out part of the call"
          onPressIn={closePress.onPressIn}
          onPressOut={closePress.onPressOut}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel="Cash out"
        >
          <Animated.View
            style={[
              styles.close,
              { backgroundColor: color.ink, opacity: blocked ? DISABLED_OPACITY : 1 },
              closePress.style,
            ]}
          >
            <ArrowDownUp size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ground} />
            <Text style={[TYPE.buttonLabel, { color: color.ground }]}>Cash out</Text>
            <View style={styles.cash}>
              <LiveOdometer source={cashOut} font={font} color={color.ground} height={CASH_HEIGHT} />
            </View>
          </Animated.View>
        </Pressable>
      ) : (
        <View style={styles.calls}>
          <CallButton label="Up" tone={color.chartUp} odds={upOdds} disabled={blocked} onPress={onUp} />
          <CallButton label="Down" tone={color.chartDown} odds={downOdds} disabled={blocked} onPress={onDown} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  presets: { flexDirection: "row", gap: SPACE.sm },
  preset: {
    flex: 1,
    minHeight: SIZE.touch - SPACE.xs,
    borderRadius: (SIZE.touch - SPACE.xs) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: { textAlign: "center" },
  calls: { flexDirection: "row", gap: SPACE.sm },
  call: { height: BUTTON_H, borderRadius: BUTTON_H / 2, alignItems: "center", justifyContent: "center", gap: 2 },
  close: {
    height: BUTTON_H,
    borderRadius: BUTTON_H / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  cash: { width: CASH_WIDTH },
});
