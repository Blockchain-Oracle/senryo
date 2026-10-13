/**
 * The phone terminal (S5 → R5; Tradash's phone workspace, Codex direction 11): the top bar with the market, equity
 * and the lanes (on Ride, the ride's life left); the full-bleed chart with its levels and band, the reactions and the
 * order stack on its left edge; the View-position pill; then the action group — Call | Ride, one sentence when
 * something holds the buttons, and UP / DOWN that morph into TRAIL / CLOSE while held. Ticks never render React
 * (`useLiveQuote`, `useLiveRide` → shared values); the flows are `@senryo/calls`', the web's own.
 */
import { ridesOn, sessionHistory } from "@senryo/calls";
import {
  type OfferSlot,
  useCallFlow,
  useExitActions,
  useGuestTap,
  useMarketLine,
  useMarketVisit,
  usePriceHealth,
} from "@senryo/calls/react";
import { useRecentCandles, useWindowLoad } from "@senryo/query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { LiveText } from "~/components/kit/LiveText";
import { useDockInset } from "~/components/shell/dock-context";
import { ViewPositionPill } from "~/features/positions/ViewPositionPill";
import { fire } from "~/feedback/fire";
import { guestSession, useAppTrader } from "~/lib/account/guest";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { balancesHidden, HIDDEN_AMOUNT } from "~/lib/hide-balances";
import { usd } from "~/lib/money";
import { notify } from "~/lib/notify";
import { openTour, useTourSeen } from "~/lib/tour";
import { tradeToast } from "~/lib/trade-toast";
import { useClockOffset } from "~/lib/use-clock-offset";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ActionPanel } from "./ActionPanel";
import { BasketMembers } from "./BasketMembers";
import { ChartFooter } from "./ChartFooter";
import { CrowdLine } from "./CrowdLine";
import { type ChartHealth, type ChartHistory, LIVE } from "./chart/constants";
import type { Head } from "./chart/draw";
import { SAMPLE_CAPACITY } from "./chart/engine";
import { LiveChart } from "./chart/LiveChart";
import { MarketsSheet } from "./MarketsSheet";
import { OrderStack } from "./OrderStack";
import { ReactionOverlay, type ReactionOverlayHandle } from "./ReactionOverlay";
import { TerminalSheets } from "./TerminalSheets";
import { TerminalTop } from "./TerminalTop";
import { useLiveQuote } from "./useLiveQuote";
import { useReactions } from "./useReactions";
import { useRideSide } from "./useRideSide";
import { useTerminal } from "./useTerminal";
import { useTerminalChoices } from "./useTerminalChoices";
import { useTerminalMusic } from "./useTerminalMusic";
import { type Sheet, useTradePanel } from "./useTradePanel";

export interface TerminalProps {
  /** First run: a title over the terminal and its one action (Skip before the call, Continue once it is live). */
  coach?: { title: string; action: string; onAction: () => void };
  /** Told when one of this screen's calls fills (setup moves on). */
  onFilled?: () => void;
}

export function TerminalScreen({ coach, onFilled }: TerminalProps = {}) {
  useTerminalMusic();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const t = useTerminal();
  const choices = useTerminalChoices();
  // A market that doesn't ride shows Call; Ride stays in the switch and says why when tapped.
  const ride = choices.instrument === "ride" && ridesOn(t.symbol);
  const load = useWindowLoad(t.window.expiry > 0 ? t.window.expiry : undefined);
  const q = useLiveQuote(
    t,
    choices.stake,
    "value" in load ? load.value : undefined,
    choices.mode,
    choices.callTrailCents,
  );
  const head = useSharedValue<Head | null>(null);
  const reactions = useRef<ReactionOverlayHandle>(null);
  const session = useMarketLine(t.symbol);
  // The chart reads it on the UI thread: not live → the line freezes, dims and shows its age or state (R1.20).
  const priceHealth = usePriceHealth(t.symbol);
  const health = useSharedValue<ChartHealth>(LIVE);
  useEffect(() => {
    health.value = { live: priceHealth.live, tag: priceHealth.tag };
  }, [health, priceHealth.live, priceHealth.tag]);
  // A closed market still shows its chart: its last session from our candle archive.
  const closed = !session.trading && !session.paused && !session.unlisted;
  const candles = useRecentCandles(t.symbol, t.now, closed);
  const history = useSharedValue<ChartHistory | null>(null);
  const historySeq = useRef(0);
  useEffect(() => {
    const past = closed && "value" in candles ? sessionHistory(candles.value.candles, SAMPLE_CAPACITY) : null;
    if (past) historySeq.current += 1;
    history.value = past ? { seq: historySeq.current, ...past } : null;
  }, [closed, candles, history]);
  // The first terminal visit on this phone opens the tour (R5.15) — on focus, not mount: the dock mounts the terminal
  // ahead of a visit (R5.24). Setup's coached terminal waits for it.
  const [toured] = useTourSeen();
  useFocusEffect(
    useCallback(() => {
      if (!toured && !coach) openTour();
    }, [toured, coach]),
  );
  // The market this phone opened: search's Recents and the market sheet's recent markets (D-337).
  useMarketVisit(t.symbol);
  // The passkey account, else on Practice the guest's device key (R5.10).
  const trader = useAppTrader();
  const account = trader.caller;
  // A visitor's first tap on Practice starts the guest and places that same trade once its dollars land.
  const placer = useRef<(slot: OfferSlot) => void>(() => undefined);
  const guestTap = useGuestTap({
    owner: trader.owner,
    symbol: t.symbol,
    sessionFor: guestSession,
    place: (slot) => placer.current(slot),
    toast: tradeToast,
  });
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [chartH, setChartH] = useState(0);
  const exits = useExitActions(account, t.cadence);
  const offsetMs = useClockOffset();
  const effects = {
    cue: (c: "press" | "filled-open" | "filled-close" | "fail") =>
      c === "press"
        ? fire("press")
        : c === "fail"
          ? fire("fail", { cue: "error" })
          : c === "filled-close"
            ? fire("close", { cue: "close" })
            : fire("filled", { cue: "open" }),
    notify: (n: { title: string; description: string }) => notify({ ...n, tone: "warning" as const }),
    toast: tradeToast,
    needAccount: (slot?: OfferSlot) => {
      if (slot !== undefined && guestTap(slot)) return;
      router.push(accountRequiredRoute(ride ? "ride" : "make a call"));
    },
    shortfall: (short: bigint) =>
      notify({
        title: `${balancesHidden() ? HIDDEN_AMOUNT : usd(short)} short`,
        description: "Top up in Wallet (test dollars in Practice), then tap again.",
        tone: "warning",
      }),
    ...(onFilled ? { onFilled } : {}),
  };
  const flow = useCallFlow({
    view: t,
    caller: account,
    stake: choices.stake,
    latest: q.latest,
    offer: q.offer,
    effects,
  });
  const side = useRideSide({
    symbol: t.symbol,
    account,
    choices,
    active: ride,
    balance: t.balance,
    nowSec: t.now,
    effects,
  });
  const trade = useTradePanel({ ride, t, q, flow, exits, side, choices, open: setSheet });
  useReactions(t.symbol, trade.onTick, reactions);
  placer.current = (slot) => void (ride ? side.flow.open(slot) : flow.open(slot));

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      {coach ? (
        <View style={styles.coach}>
          <Text style={[TYPE.title, { color: color.ink }]}>{coach.title}</Text>
          <Button label={coach.action} variant="ghost" size="sm" block={false} onPress={coach.onAction} />
        </View>
      ) : null}
      <TerminalTop
        t={t}
        offsetMs={offsetMs}
        ride={ride}
        rideEndsIn={side.flow.endsIn}
        onPickMarket={() => setPicking(true)}
      />
      <View style={styles.chart} onLayout={(e) => setChartH(e.nativeEvent.layout.height)}>
        <LiveChart
          symbol={t.symbol}
          overlay={trade.overlay}
          waiting={`Waiting for ${t.symbol}…`}
          head={head}
          health={health}
          history={history}
          candles={choices.candles ? choices.candleInterval : null}
        />
        <ReactionOverlay ref={reactions} head={head} />
        {chartH > 0 ? (
          <OrderStack
            heading={trade.stack.heading}
            rows={trade.stack.rows}
            height={chartH}
            onOpen={() => setSheet("order")}
          />
        ) : null}
      </View>
      <ChartFooter
        candles={choices.candles}
        interval={choices.candleInterval}
        onCandles={choices.setCandles}
        onInterval={choices.setCandleInterval}
      />
      {ride ? null : (
        <>
          <LiveText text={q.lineText} style={[TYPE.caption, styles.line, { color: color.inkMuted }]} />
          <CrowdLine windowId={t.window.windowId} />
          <BasketMembers symbol={t.symbol} />
        </>
      )}
      <View style={[styles.actions, { paddingBottom: bottom }]}>
        <ViewPositionPill onOpen={() => setSheet("positions")} />
        <ActionPanel
          symbol={t.symbol}
          session={session}
          instrument={ride ? "ride" : "call"}
          onInstrument={(next) => {
            if (next === "ride" && !ridesOn(t.symbol)) {
              fire("fail");
              notify({
                title: `Rides aren't available on ${t.symbol}`,
                description: "Rides are on BTC, ETH, SOL, XRP, BNB, DOGE and HYPE.",
              });
              return;
            }
            fire("tick");
            choices.setInstrument(next);
          }}
          state={trade.panel}
          holding={trade.holding}
          quoteNote={ride ? null : q.note}
          buttons={trade.buttons}
        />
      </View>
      <TerminalSheets
        sheet={sheet}
        setSheet={setSheet}
        ride={ride}
        t={t}
        q={q}
        flow={flow}
        exits={exits}
        side={side}
        choices={choices}
      />
      {picking ? (
        <MarketsSheet
          markets={t.markets}
          selected={t.symbol}
          onPick={(s) => t.setSymbol(s)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  chart: { flex: 1, marginTop: SPACE.sm },
  line: { textAlign: "center", paddingVertical: SPACE.xs },
  actions: { gap: SPACE.sm },
  coach: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZE.gutter,
    paddingBottom: SPACE.sm,
  },
});
