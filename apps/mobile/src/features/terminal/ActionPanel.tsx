/**
 * The phone terminal's action group (Codex direction 11 §1, §5–6, R5.4–R5.5): Call | Ride with one-tap's state beside
 * it, one plain sentence when something holds the buttons (a call or ride in flight, the lockout, a stale price, a
 * window nobody opened, a call side too one-sided to price), then the trade buttons — UP / DOWN, or TRAIL / CLOSE while
 * held. A market outside its session says so; Real before mainnet points to Practice (D-320); rides with real money
 * stay on the web until S9 (D-305), so Ride in Real offers Practice.
 */
import { closedWords, INSTRUMENTS, type Instrument, type MarketLine } from "@senryo/calls";
import type { PanelState } from "@senryo/calls/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { LiveText } from "~/components/kit/LiveText";
import { Segmented } from "~/components/kit/Segmented";
import { fire } from "~/feedback/fire";
import { setActiveNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { OneTapLine } from "./OneTapLine";
import { TradeButtons, type TradeButtonsProps } from "./TradeButtons";

const CALL_H = 52;
const CALL_RADIUS = 12;
const CALL_EDGE = 3;

function noticeOf(state: PanelState): string | null {
  if (state.kind === "pending") return state.label;
  if (state.kind === "locked" || state.kind === "stale") return state.text;
  if (state.kind === "no-price") return "Waiting for the opening price";
  return null;
}

function ToPractice({ title, body }: { title: string; body: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{body}</Text>
      <Pressable
        onPress={() => {
          fire("snap", { cue: "toggle" });
          setActiveNetwork("testnet");
        }}
        accessibilityRole="button"
        style={[styles.practice, { backgroundColor: color.rangeFill, borderBottomColor: color.rangeFillEdge }]}
      >
        <Text style={[TYPE.buttonLabel, { color: color.onDirectionFill }]}>Switch to Practice</Text>
      </Pressable>
    </View>
  );
}

function ClosedPanel({ symbol, line }: { symbol: string; line: MarketLine }) {
  const { color } = useTheme();
  const readOnly = useReadOnlyNetwork();
  // Real before mainnet (D-320): every price is live and browsable; the calls are in Practice, one tap away.
  if (readOnly && line.unlisted) {
    return (
      <ToPractice
        title="Trading opens with mainnet"
        body={`${symbol}'s price is live. Make your calls in Practice meanwhile.`}
      />
    );
  }
  const words = closedWords(symbol, line);
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{words.title}</Text>
      <Text style={[TYPE.body, { color: color.inkMuted }]}>{line.text}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.note}</Text>
    </View>
  );
}

export interface ActionPanelProps {
  symbol: string;
  session: MarketLine;
  instrument: Instrument;
  onInstrument: (i: Instrument) => void;
  state: PanelState;
  holding: boolean;
  /** A call's "Too one-sided to price right now", when nothing else holds the buttons ("" for none). */
  quoteNote: SharedValue<string> | null;
  buttons: TradeButtonsProps;
}

export function ActionPanel(p: ActionPanelProps) {
  const { color } = useTheme();
  const readOnly = useReadOnlyNetwork();
  if (!p.session.trading && !p.holding) return <ClosedPanel symbol={p.symbol} line={p.session} />;
  const notice = noticeOf(p.state);
  const realRide = p.instrument === "ride" && readOnly && !p.holding;
  return (
    <View style={styles.wrap}>
      <View style={styles.switch}>
        <View style={styles.flex}>
          <Segmented options={INSTRUMENTS} value={p.instrument} onChange={p.onInstrument} label="Call or ride" />
        </View>
        <OneTapLine compact />
      </View>
      {realRide ? (
        <ToPractice
          title="Rides are Practice-only on the phone"
          body="Ride with test dollars here, or with real money on the web."
        />
      ) : (
        <>
          {notice ? (
            <Text style={[TYPE.caption, styles.notice, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : p.quoteNote && !p.holding ? (
            <LiveText text={p.quoteNote} style={[TYPE.caption, styles.notice, { color: color.inkMuted }]} />
          ) : null}
          <TradeButtons {...p.buttons} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  switch: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  flex: { flex: 1 },
  notice: { textAlign: "center" },
  practice: {
    height: CALL_H,
    borderRadius: CALL_RADIUS,
    borderBottomWidth: CALL_EDGE,
    alignItems: "center",
    justifyContent: "center",
  },
});
