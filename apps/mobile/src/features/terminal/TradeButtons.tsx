/**
 * The phone's trade buttons (Tradash's two, Owarine `TradeButtons`, Codex direction 11 §3, R5.5) in Senryo's plates.
 * - Entry: UP / DOWN (or RANGE alone, MOONSHOT / CRASH) on their direction fills (black labels, a darker 3 pt bottom
 *   edge), the line under each — a call's "Pays 2.14× · $10.70", a ride's "Knocked out at $80,431". A side with no
 *   price is a recessed plate taking no tap.
 * - Held: TRAIL (the up tint, solid once armed; muted with "Need +0.08% to trail" until it qualifies) and CLOSE, which
 *   always carries the amount it returns, rolling. Hold CLOSE for a part; hold TRAIL for the full exit.
 * The pair cross-fades (rise 12, 180 ms) keyed by instrument and state.
 */
import type { OfferedBand } from "@senryo/calls";
import { useFont } from "@shopify/react-native-skia";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { LiveText } from "~/components/kit/LiveText";
import { ArrowDown, ArrowUp, Plunge, RangeBand, Surge, X } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { HOLD_MS } from "./constants";
import type { HeldState } from "./useHeldState";

const CALL_H = 52;
const CALL_RADIUS = 12;
const CALL_EDGE = 3;
const CALL_TRACKING = 1;
const HELD_H = 64;
const HELD_RADIUS = 16;
const SWAP_MS = 180;
const CASH_SIZE = 17;
const CASH_HEIGHT = 22;
const CASH_WIDTH = 96;
const UNPRICED = "—";

export interface Side {
  kind: OfferedBand["band"]["kind"];
  label: string;
  line: SharedValue<string>;
}

const MARK = { up: ArrowUp, down: ArrowDown, range: RangeBand, moonshot: Surge, crash: Plunge } as const;

export type TradeButtonsProps = { instrument: "call" | "ride" } & (
  | {
      mode: "entry";
      sides: readonly [Side] | readonly [Side, Side];
      disabled: boolean;
      onPick: (slot: 0 | 1) => void;
      onPreview: (slot: 0 | 1 | null) => void;
    }
  | {
      mode: "held";
      closeWord: string;
      close: SharedValue<LiveFigure>;
      trailCaption: SharedValue<string>;
      state: HeldState | null;
      busy: "close" | "trail" | null;
      /** Why the close is held (the lockout, a pending fill), or null. */
      held: string | null;
      onClose: () => void;
      onClosePart?: () => void;
      onTrail: () => void;
      onExit?: () => void;
    }
);

function EntryButton({
  side,
  slot,
  disabled,
  onPick,
  onPreview,
}: {
  side: Side;
  slot: 0 | 1;
  disabled: boolean;
  onPick: (slot: 0 | 1) => void;
  onPreview: (slot: 0 | 1 | null) => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const up = side.kind === "up" || side.kind === "moonshot";
  const down = side.kind === "down" || side.kind === "crash";
  const fill = up ? color.upFill : down ? color.downFill : color.rangeFill;
  const edge = up ? color.upFillEdge : down ? color.downFillEdge : color.rangeFillEdge;
  const recessed = color.raised2;
  const plate = useAnimatedStyle(() => {
    const priced = side.line.value !== UNPRICED;
    return { backgroundColor: priced ? fill : recessed, borderBottomColor: priced ? edge : recessed };
  });
  const Mark = MARK[side.kind];
  return (
    <View style={styles.slot}>
      <Pressable
        onPress={() => side.line.value !== UNPRICED && onPick(slot)}
        onPressIn={() => {
          press.onPressIn();
          onPreview(slot);
        }}
        onPressOut={() => {
          press.onPressOut();
          onPreview(null);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={side.label}
        accessibilityState={{ disabled }}
      >
        <Animated.View style={[styles.call, { opacity: disabled ? DISABLED_OPACITY : 1 }, plate, press.style]}>
          <Mark size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.onDirectionFill} />
          <Text numberOfLines={1} style={[TYPE.buttonLabel, styles.label, { color: color.onDirectionFill }]}>
            {side.label}
          </Text>
        </Animated.View>
      </Pressable>
      <LiveText text={side.line} style={[TYPE.micro, styles.caption, { color: color.inkMuted }]} />
    </View>
  );
}

function HeldButtons(p: Extract<TradeButtonsProps, { mode: "held" }>) {
  const { color } = useTheme();
  const trailPress = usePressScale();
  const closePress = usePressScale();
  const font = useFont(require("../../../assets/fonts/Inter-SemiBold.ttf"), CASH_SIZE);
  const armed = p.state?.armed ?? false;
  const trailOff = p.held !== null || p.busy !== null || !p.state || (!armed && !p.state.ready);
  const closeOff = p.held !== null || p.busy !== null || !p.state?.closable;
  const hold = (run: (() => void) | undefined) =>
    run
      ? () => {
          fire("snap");
          run();
        }
      : undefined;
  return (
    <>
      <View style={styles.slot}>
        <Pressable
          onPress={armed ? (p.onExit ?? p.onTrail) : p.onTrail}
          onLongPress={hold(p.onExit)}
          delayLongPress={HOLD_MS}
          onPressIn={trailPress.onPressIn}
          onPressOut={trailPress.onPressOut}
          disabled={trailOff}
          accessibilityRole="button"
          accessibilityLabel={armed ? "Trailing. Change the exit" : "Trail"}
          accessibilityState={{ disabled: trailOff, selected: armed }}
        >
          <Animated.View
            style={[
              styles.held,
              { backgroundColor: armed ? color.upFill : color.upWash, opacity: trailOff ? DISABLED_OPACITY : 1 },
              trailPress.style,
            ]}
          >
            <Surge size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={armed ? color.onDirectionFill : color.up} />
            <Text style={[TYPE.buttonLabel, styles.label, { color: armed ? color.onDirectionFill : color.up }]}>
              {p.busy === "trail" ? "Arming…" : armed ? "Trailing" : "Trail"}
            </Text>
          </Animated.View>
        </Pressable>
        <LiveText text={p.trailCaption} style={[TYPE.micro, styles.caption, { color: color.inkMuted }]} />
      </View>
      <View style={styles.slot}>
        <Pressable
          onPress={p.onClose}
          onLongPress={hold(p.onClosePart)}
          delayLongPress={HOLD_MS}
          onPressIn={closePress.onPressIn}
          onPressOut={closePress.onPressOut}
          disabled={closeOff}
          accessibilityRole="button"
          accessibilityLabel={p.closeWord}
          accessibilityHint="Hold to close part of it"
          accessibilityState={{ disabled: closeOff }}
        >
          <Animated.View
            style={[
              styles.held,
              { backgroundColor: color.ink, opacity: closeOff ? DISABLED_OPACITY : 1 },
              closePress.style,
            ]}
          >
            <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ground} />
            <View>
              <Text style={[TYPE.buttonLabel, styles.label, { color: color.ground }]}>{p.closeWord}</Text>
              <View style={styles.cash}>
                <LiveOdometer source={p.close} font={font} color={color.ground} height={CASH_HEIGHT} sensitive />
              </View>
            </View>
          </Animated.View>
        </Pressable>
        <Text style={[TYPE.micro, styles.caption, { color: color.inkMuted }]}>{p.held ?? ""}</Text>
      </View>
    </>
  );
}

export function TradeButtons(props: TradeButtonsProps) {
  return (
    <Animated.View
      key={`${props.instrument}-${props.mode}`}
      entering={FadeInDown.duration(SWAP_MS)}
      exiting={FadeOutUp.duration(SWAP_MS)}
      style={styles.pair}
    >
      {props.mode === "entry" ? (
        props.sides.map((side, i) => (
          <EntryButton
            key={side.kind}
            side={side}
            slot={i as 0 | 1}
            disabled={props.disabled}
            onPick={props.onPick}
            onPreview={props.onPreview}
          />
        ))
      ) : (
        <HeldButtons {...props} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: SPACE.md },
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
  held: {
    height: HELD_H,
    borderRadius: HELD_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  label: { textTransform: "uppercase", letterSpacing: CALL_TRACKING },
  caption: { textAlign: "center", minHeight: SPACE.lg },
  cash: { width: CASH_WIDTH, height: CASH_HEIGHT },
});
