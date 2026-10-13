/**
 * One open position on the phone, a live object (D-343, Codex direction 15): the market's mark inside a ring draining
 * to its end on the server's clock, "BTC ↑ · 10×" over the time left ticking by itself and the trade's own recorded
 * PnL path, then its PnL rolling (dollars first, ROI under). A tap opens the terminal on this exact position (D-340);
 * a swipe left reveals "Close $5.04" — only revealed, a separate tap closes; a long-press offers Position details and
 * View receipt. Nothing else at rest: entry, levels, margin and fees live on the chart and in details.
 */
import {
  type BookEntry,
  closeOffered,
  closeWord,
  dollars,
  pnlText,
  positionIntent,
  positionSpan,
  roiText,
} from "@senryo/calls";
import { usePositionRow, useTerminalReady } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { intentParams } from "@senryo/search";
import type { SkFont } from "@shopify/react-native-skia";
import { router } from "expo-router";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { CountdownRing } from "~/components/kit/CountdownRing";
import { ReadyRing } from "~/components/kit/ReadyRing";
import { RollingFigure } from "~/components/kit/RollingFigure";
import { fire } from "~/feedback/fire";
import { HIDDEN_AMOUNT, masked, useHideBalances } from "~/lib/hide-balances";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { PositionSheet } from "./PositionSheet";
import { PositionTrace } from "./PositionTrace";

/** The figures while a close is on its way: still readable, plainly not live. */
const CLOSING_OPACITY = 0.45;
const ROW = 80;
const MARK = 32;
const RING = 40;
const RING_STROKE = 2;
const RING_LAST_STROKE = 3;
const FIGURE_W = 120;
const FIGURE_H = 28;
const ACTION_W = 112;
const HALF = 2;

/** The one revealed row in a list: opening another closes it. */
export type OpenSwipe = RefObject<SwipeableMethods | null>;

function Mark({ e, offsetMs }: { e: BookEntry; offsetMs: SharedValue<number> }) {
  const { color } = useTheme();
  const span = positionSpan(e);
  return (
    <View style={styles.mark}>
      {span ? (
        <CountdownRing
          fromSec={span.fromSec}
          toSec={span.toSec}
          offsetMs={offsetMs}
          size={RING}
          stroke={RING_STROKE}
          lastStroke={RING_LAST_STROKE}
          color={color.inkMuted}
          warn={color.ink}
          track={color.muted}
        />
      ) : null}
      <View style={styles.markInner}>
        <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
      </View>
    </View>
  );
}

function Figures({ e, font, hidden }: { e: BookEntry; font: SkFont | null; hidden: boolean }) {
  const { color } = useTheme();
  // Closing: the last figure holds, muted, until the result arrives.
  const held = useRef({ pnl: e.pnl, roi: e.roiBps });
  if (e.state !== "closing") held.current = { pnl: e.pnl, roi: e.roiBps };
  const { pnl, roi } = held.current;
  if (pnl === null || roi === null) {
    return (
      <View style={styles.figures}>
        <Text style={[TYPE.rowPrice, { color: color.inkMuted }]}>—</Text>
      </View>
    );
  }
  const tone = e.state === "closing" ? color.inkMuted : pnl >= 0n ? color.up : color.down;
  return (
    <View style={styles.figures}>
      {hidden ? (
        <Text style={[TYPE.rowPrice, { color: color.inkMuted }]}>{HIDDEN_AMOUNT}</Text>
      ) : (
        <View style={styles.figure}>
          <RollingFigure
            text={pnlText(pnl)}
            value={pnl}
            font={font}
            color={tone}
            height={FIGURE_H}
            accessibilityLabel={`PnL ${pnlText(pnl)}`}
          />
        </View>
      )}
      <Text style={[TYPE.moneyMeta, { color: hidden ? color.inkMuted : tone }]}>{masked(roiText(roi), hidden)}</Text>
    </View>
  );
}

function CloseAction({
  e,
  ready,
  closing,
  onPress,
}: {
  e: BookEntry;
  ready: boolean;
  closing: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const amount = e.closeValue === null ? "—" : masked(dollars(e.closeValue), hidden);
  return (
    <View style={styles.actionWrap}>
      <ReadyRing on={ready} radius={RADIUS.xs}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${closeWord(e)} ${amount}`}
          disabled={e.closeValue === null || closing}
          accessibilityState={{ disabled: e.closeValue === null || closing, busy: closing }}
          onPress={onPress}
          style={[styles.action, { backgroundColor: color.accent }]}
        >
          <Text style={[TYPE.buttonCompact, { color: color.accentForeground }]}>{closeWord(e)}</Text>
          <Text style={[TYPE.moneyMeta, { color: color.accentForeground }]}>{amount}</Text>
        </Pressable>
      </ReadyRing>
    </View>
  );
}

export function PositionRow({
  entry: e,
  closing,
  onClose,
  font,
  offsetMs,
  openSwipe,
  onPick,
}: {
  entry: BookEntry;
  closing: boolean;
  onClose: (e: BookEntry) => void;
  font: SkFont | null;
  offsetMs: SharedValue<number>;
  openSwipe: OpenSwipe;
  /** After a tap opens the trade (the terminal's sheet closes itself). */
  onPick?: () => void;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const { head, clock, samples, now } = usePositionRow(e);
  // A close on its way says so at once and holds until it settles (D3): the tap is never met by nothing.
  const clockText = closing ? (e.kind === "ride" ? "Closing…" : "Cashing out…") : clock.text;
  const swipe = useRef<SwipeableMethods>(null);
  const [menu, setMenu] = useState(false);
  // A link (search's position, D-340) asked for this one: its Close revealed and ringed, never pressed.
  const ready = useTerminalReady().position === e.key;
  // The swipe follows the position's state, not each tick's quote: a quote that flickers away mid-gesture must not snap
  // the row shut under the finger (the tap would land on the row and open the trade instead of closing).
  const canClose = closeOffered(e, now) && !closing;
  // Revealed, the row's own tap only tucks the action away (Codex 15 §2: no navigation after a recognised swipe).
  const revealed = useRef(false);
  useEffect(() => {
    if (ready && canClose) swipe.current?.openRight();
  }, [ready, canClose]);
  const openTrade = () => {
    if (revealed.current) {
      swipe.current?.close();
      return;
    }
    fire("tick", { cue: "tap" });
    router.navigate({ pathname: "/trade", params: { symbol: e.symbol, ...intentParams(positionIntent(e)) } });
    onPick?.();
  };
  return (
    <>
      <ReanimatedSwipeable
        ref={swipe}
        enabled={canClose}
        friction={1}
        overshootRight={false}
        rightThreshold={ACTION_W / HALF}
        renderRightActions={() => (
          <CloseAction
            e={e}
            ready={ready}
            closing={closing}
            onPress={() => {
              swipe.current?.close();
              onClose(e);
            }}
          />
        )}
        onSwipeableClose={() => {
          revealed.current = false;
        }}
        onSwipeableWillOpen={() => {
          revealed.current = true;
          fire("snap");
          if (openSwipe.current && openSwipe.current !== swipe.current) openSwipe.current.close();
          openSwipe.current = swipe.current;
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${e.symbol} position`}
          accessibilityHint={clockText}
          accessibilityActions={[
            { name: "activate" },
            ...(canClose ? [{ name: "actions", label: "Show position actions" }] : []),
            { name: "longpress", label: "Position details" },
          ]}
          onAccessibilityAction={(ev) => {
            if (ev.nativeEvent.actionName === "actions") swipe.current?.openRight();
            else if (ev.nativeEvent.actionName === "longpress") setMenu(true);
            else openTrade();
          }}
          onPress={openTrade}
          onLongPress={() => {
            fire("tick", { cue: "sheetOpen" });
            setMenu(true);
          }}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? color.rowPressed : color.raised2 }]}
        >
          <Mark e={e} offsetMs={offsetMs} />
          <View style={styles.middle}>
            <Text numberOfLines={1} style={[TYPE.rowStrong, { color: color.ink }]}>
              {head}
            </Text>
            <View style={styles.clockLine}>
              <Text numberOfLines={2} style={[TYPE.meta, styles.clock, { color: color.inkMuted }]}>
                {clockText}
              </Text>
              {hidden ? null : <PositionTrace samples={samples} dim={e.state === "no-price"} />}
            </View>
          </View>
          <View style={closing ? styles.closing : null}>
            <Figures e={e} font={font} hidden={hidden} />
          </View>
        </Pressable>
      </ReanimatedSwipeable>
      {menu ? <PositionSheet e={e} onClose={() => setMenu(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  closing: { opacity: CLOSING_OPACITY },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: ROW,
    paddingHorizontal: SPACE.md,
  },
  mark: { width: RING, height: RING },
  markInner: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, minWidth: 0, gap: SPACE.xs },
  clockLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  clock: { flexShrink: 1 },
  figures: { alignItems: "flex-end", minWidth: FIGURE_W },
  figure: { width: FIGURE_W, height: FIGURE_H },
  actionWrap: { justifyContent: "center", paddingHorizontal: SPACE.sm },
  action: {
    width: ACTION_W,
    minHeight: SIZE.touch,
    borderRadius: RADIUS.xs,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.xs,
  },
});
