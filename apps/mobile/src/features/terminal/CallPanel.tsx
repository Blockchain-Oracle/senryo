/**
 * The call panel (Tradash's UP/DOWN ↔ CLOSE, Owarine's `TradeButtons`, F8): the stake (last one remembered; $1 · $5 ·
 * $10 · $25 · Max), then the mode's buttons — label only on their direction fills (black labels, a darker 3 px bottom
 * edge), "Pays 1.92× · $9.60" under each; holding a button shades where it wins on the chart; a side with no price turns
 * a recessed plate with "—" while one sentence under the pair says why — or, holding a call in this window, one CLOSE
 * with the cash-out value rolling and, under it, its exit (take profit, stop, trail — S8.4). Honest states: calls
 * closed for the lockout, a stale price, a call in flight.
 */
import { CALL_MODES, type CallMode, closedWords, type MarketLine, type Offer, type OfferedBand } from "@senryo/calls";
import type { OfferSlot, PanelState } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useFont } from "@shopify/react-native-skia";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { LiveText } from "~/components/kit/LiveText";
import { Segmented } from "~/components/kit/Segmented";
import { ArrowDown, ArrowDownUp, ArrowUp, Crosshair, Plunge, RangeBand, Surge } from "~/components/kit/symbols";
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
/** The call buttons (F8, research 10 §1): 52 pt, 12 pt corners, a 3 pt darker bottom edge. */
const CALL_H = 52;
const CALL_RADIUS = 12;
const CALL_EDGE = 3;
/** The labels' tracking (the web's 0.06 em at 16 px, in points). */
const CALL_TRACKING = 1;
/** A side's pays line reads this while it has no price: the button turns a recessed plate and takes no tap. */
const UNPRICED = "—";
const MARK: Readonly<Record<OfferedBand["band"]["kind"], typeof ArrowUp>> = {
  up: ArrowUp,
  down: ArrowDown,
  range: RangeBand,
  moonshot: Surge,
  crash: Plunge,
};
const CASH_SIZE = 20;
const CASH_HEIGHT = 26;
const CASH_WIDTH = 120;

export type { PanelState } from "@senryo/calls/react";

function CallButton({
  offered,
  odds,
  disabled,
  onPress,
  onPreview,
}: {
  offered: OfferedBand;
  odds: SharedValue<string>;
  disabled: boolean;
  onPress: () => void;
  onPreview: (on: boolean) => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  // Up and Moonshot on the up fill, Down and Crash on the down fill, Range on its cyan (D-316); black labels.
  const fill = offered.tone === "up" ? color.upFill : offered.tone === "down" ? color.downFill : color.rangeFill;
  const edge =
    offered.tone === "up" ? color.upFillEdge : offered.tone === "down" ? color.downFillEdge : color.rangeFillEdge;
  const recessed = color.raised2;
  const plate = useAnimatedStyle(() => {
    const priced = odds.value !== UNPRICED;
    return {
      backgroundColor: priced ? fill : recessed,
      borderBottomColor: priced ? edge : recessed,
    };
  });
  const directional = offered.band.kind === "up" || offered.band.kind === "down";
  const Mark = MARK[offered.band.kind];
  return (
    <View style={styles.slot}>
      <Pressable
        onPress={() => odds.value !== UNPRICED && onPress()}
        onPressIn={() => {
          press.onPressIn();
          onPreview(true);
        }}
        onPressOut={() => {
          press.onPressOut();
          onPreview(false);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Call ${offered.label}${directional ? "" : `, ${offered.where}`}`}
        accessibilityState={{ disabled }}
      >
        <Animated.View style={[styles.call, { opacity: disabled ? DISABLED_OPACITY : 1 }, plate, press.style]}>
          <Mark size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.onDirectionFill} />
          <Text numberOfLines={1} style={[TYPE.buttonLabel, styles.callLabel, { color: color.onDirectionFill }]}>
            {offered.label}
          </Text>
        </Animated.View>
      </Pressable>
      <LiveText text={odds} style={[TYPE.micro, styles.pays, { color: color.inkMuted }]} />
    </View>
  );
}

/** A market outside its session (D-289): no new calls until it opens; the chart shows the last print. */
function ClosedPanel({ symbol, line }: { symbol: string; line: MarketLine }) {
  const { color } = useTheme();
  const words = closedWords(symbol, line);
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{words.title}</Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{line.text}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.note}</Text>
    </View>
  );
}

export function CallPanel(props: Parameters<typeof OpenPanel>[0] & { symbol: string; session: MarketLine }) {
  if (!props.session.trading && !props.holding) return <ClosedPanel symbol={props.symbol} line={props.session} />;
  return <OpenPanel {...props} />;
}

function OpenPanel({
  state,
  stake,
  balance,
  onStake,
  mode,
  onMode,
  offer,
  firstOdds,
  secondOdds,
  quoteNote,
  onPreview,
  holding,
  cashOut,
  onPick,
  onClose,
  onCustom,
  onClosePart,
  exitLine,
  onExit,
}: {
  state: PanelState;
  stake: bigint;
  balance: bigint | undefined;
  onStake: (stake: bigint) => void;
  mode: CallMode;
  onMode: (mode: CallMode) => void;
  offer: Offer;
  firstOdds: SharedValue<string>;
  secondOdds: SharedValue<string>;
  /** Why a shown side has no price (one sentence under the buttons), or "". */
  quoteNote: SharedValue<string>;
  /** Shade where the held side wins on the chart (null clears it). */
  onPreview: (side: 0 | 1 | null) => void;
  holding: boolean;
  cashOut: SharedValue<LiveFigure>;
  onPick: (slot: OfferSlot) => void;
  onClose: () => void;
  /** The keypad for any other stake. */
  onCustom: () => void;
  /** Long-press on Cash out: a part of the call (25 / 50 / 100 %). */
  onClosePart: () => void;
  /** The armed exit in words, or null. */
  exitLine: string | null;
  onExit: () => void;
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
          ? state.text
          : state.kind === "no-price"
            ? "Waiting for the opening price"
            : null;

  return (
    <View style={styles.wrap}>
      {holding ? null : (
        <Segmented
          options={CALL_MODES}
          value={mode}
          onChange={(m) => {
            fire("tick");
            onMode(m);
          }}
          label="Way to call"
        />
      )}
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
          {/* Max only with a balance to spend (R2.15: no control that does nothing; a guest has none). */}
          {balance !== undefined ? (
            <Pressable
              onPress={() => {
                fire("tick");
                onStake(balance);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: stake === balance }}
              accessibilityLabel="Max"
              style={[styles.preset, { backgroundColor: stake === balance ? color.ink : color.raised2 }]}
            >
              <Text style={[TYPE.rowTitle, { color: stake === balance ? color.ground : color.ink }]}>Max</Text>
            </Pressable>
          ) : null}
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
      ) : null}
      {holding ? (
        <Pressable
          onPress={() => {
            fire("snap");
            onExit();
          }}
          accessibilityRole="button"
          accessibilityLabel={exitLine ? `Exit: ${exitLine}. Change` : "Set an exit: take profit, stop or trail"}
          style={({ pressed }) => [styles.exit, pressed && { opacity: DISABLED_OPACITY }]}
        >
          <Crosshair size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={exitLine ? color.ink : color.inkMuted} />
          <Text
            numberOfLines={1}
            style={[TYPE.caption, styles.flexText, { color: exitLine ? color.ink : color.inkMuted }]}
          >
            {exitLine ?? "Set an exit · take profit, stop, trail"}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.calls}>
          {offer[0] ? (
            <CallButton
              offered={offer[0]}
              odds={firstOdds}
              disabled={blocked}
              onPress={() => onPick(0)}
              onPreview={(on) => onPreview(on ? 0 : null)}
            />
          ) : null}
          {offer[1] ? (
            <CallButton
              offered={offer[1]}
              odds={secondOdds}
              disabled={blocked}
              onPress={() => onPick(1)}
              onPreview={(on) => onPreview(on ? 1 : null)}
            />
          ) : null}
        </View>
      )}
      {holding ? null : <LiveText text={quoteNote} style={[TYPE.caption, styles.notice, { color: color.inkMuted }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
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
  slot: { flex: 1, gap: SPACE.xs },
  call: {
    height: CALL_H,
    borderRadius: CALL_RADIUS,
    borderBottomWidth: CALL_EDGE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
  },
  callLabel: { textTransform: "uppercase", letterSpacing: CALL_TRACKING },
  pays: { textAlign: "center" },
  close: {
    height: BUTTON_H,
    borderRadius: BUTTON_H / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  cash: { width: CASH_WIDTH },
  exit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs, minHeight: SIZE.touch },
  flexText: { flexShrink: 1 },
});
