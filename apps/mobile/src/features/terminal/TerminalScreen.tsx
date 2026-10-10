/**
 * The terminal (S5; Tradash's phone workspace on Senryo's windows): top bar, the full-bleed live chart with K, the
 * distance to the line, and the call panel. Ticks never render React here (`useLiveQuote` → shared values); the screen
 * renders on events and once a second for the countdown. The call flow — the panel's states, open and cash out with
 * their guards, following a call to its fill — is `@senryo/calls` `useCallFlow`, the same on the web.
 */
import { type CallMode, exitLine, isCallMode } from "@senryo/calls";
import { useCallFlow, useExitActions, useMarketLine, usePriceHealth } from "@senryo/calls/react";
import { type ExitPrices, hasExit } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useWindowLoad } from "@senryo/query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { LiveText } from "~/components/kit/LiveText";
import { useDockInset } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { BasketMembers } from "./BasketMembers";
import { CallPanel } from "./CallPanel";
import { CashOutSheet } from "./CashOutSheet";
import { CrowdLine } from "./CrowdLine";
import { type ChartHealth, LIVE } from "./chart/constants";
import type { Head } from "./chart/draw";
import { LiveChart } from "./chart/LiveChart";
import { ExitSheet } from "./ExitSheet";
import { MarketsSheet } from "./MarketsSheet";
import { ReactionOverlay, type ReactionOverlayHandle } from "./ReactionOverlay";
import { StakeSheet } from "./StakeSheet";
import { TerminalTop } from "./TerminalTop";
import { useLiveQuote } from "./useLiveQuote";
import { useReactions } from "./useReactions";
import { useTerminal } from "./useTerminal";

const DEFAULT_STAKE = 5_000_000;
const MIN_STAKE = 1_000_000n;
const CLOCK_SYNC_MS = 5_000;

export interface TerminalProps {
  /** First run: a title over the terminal and its one action (Skip before the call, Continue once it is live). */
  coach?: { title: string; action: string; onAction: () => void };
  /** Told when one of this screen's calls fills (setup moves on). */
  onFilled?: () => void;
}

export function TerminalScreen({ coach, onFilled }: TerminalProps = {}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const live = useLive();
  const t = useTerminal();
  const [storedStake, setStoredStake] = useMMKVNumber(STORAGE_KEYS.lastStake, storage);
  const stake = BigInt(storedStake ?? DEFAULT_STAKE);
  const [storedMode, setMode] = useMMKVString(STORAGE_KEYS.terminalMode, storage);
  const mode: CallMode = isCallMode(storedMode) ? storedMode : "updown";
  const load = useWindowLoad(t.window.expiry > 0 ? t.window.expiry : undefined);
  const q = useLiveQuote(t, stake, "value" in load ? load.value : undefined, mode);
  const head = useSharedValue<Head | null>(null);
  const reactions = useRef<ReactionOverlayHandle>(null);
  useReactions(t.symbol, q.onTick, reactions);
  const session = useMarketLine(t.symbol);
  // The chart reads it on the UI thread: not live → the line freezes, dims and shows its age or state (R1.20).
  const priceHealth = usePriceHealth(t.symbol);
  const health = useSharedValue<ChartHealth>(LIVE);
  useEffect(() => {
    health.value = { live: priceHealth.live, tag: priceHealth.tag };
  }, [health, priceHealth.live, priceHealth.tag]);
  const account = useAccount();
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<"stake" | "part" | "exit" | null>(null);
  const exits = useExitActions(account);
  const offsetMs = useSharedValue(live.clock.offset);
  const flow = useCallFlow({
    view: t,
    caller: account,
    stake,
    latest: q.latest,
    offer: q.offer,
    effects: {
      cue: (c) =>
        c === "press"
          ? fire("press")
          : c === "fail"
            ? fire("fail", { sound: "error" })
            : fire("filled", { cue: c === "filled-close" ? "close" : "open" }),
      notify: (n) => notify({ ...n, tone: "warning" }),
      needAccount: () => router.push(accountRequiredRoute("make a call")),
      ...(onFilled ? { onFilled } : {}),
    },
  });

  const position = t.position;
  const closeQuote = q.latest.current.close;
  const setExit = async (prices: ExitPrices) => {
    if (!position) return;
    try {
      const r = await exits.set(position.ticketId, prices);
      if (r.kind === "cancelled") return;
      setSheet(null);
      fire("confirm");
      notify(
        hasExit(prices)
          ? { title: "Exit set", description: "It runs with the app closed." }
          : { title: "Exit removed", description: "Nothing sells on its own now." },
      );
    } catch (error) {
      fire("fail", { sound: "error" });
      notify({ title: "Couldn't set the exit", description: (error as Error).message, tone: "warning" });
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      offsetMs.value = live.clock.offset;
    }, CLOCK_SYNC_MS);
    return () => clearInterval(id);
  }, [live, offsetMs]);

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      {coach ? (
        <View style={styles.coach}>
          <Text style={[TYPE.title, { color: color.ink }]}>{coach.title}</Text>
          <Button label={coach.action} variant="ghost" size="sm" block={false} onPress={coach.onAction} />
        </View>
      ) : null}
      <TerminalTop t={t} offsetMs={offsetMs} onPickMarket={() => setPicking(true)} />
      <View style={styles.chart}>
        <LiveChart
          symbol={t.symbol}
          overlay={q.overlay}
          waiting={`Waiting for ${t.symbol}…`}
          head={head}
          health={health}
        />
        <ReactionOverlay ref={reactions} head={head} />
      </View>
      <LiveText text={q.lineText} style={[TYPE.caption, styles.line, { color: color.inkMuted }]} />
      <CrowdLine windowId={t.window.windowId} />
      <BasketMembers symbol={t.symbol} />
      <View style={{ paddingBottom: bottom }}>
        <CallPanel
          symbol={t.symbol}
          session={session}
          state={flow.panel}
          stake={stake}
          balance={t.balance}
          onStake={(s) => setStoredStake(Number(s))}
          mode={mode}
          onMode={setMode}
          offer={q.offer}
          firstOdds={q.firstLine}
          secondOdds={q.secondLine}
          holding={flow.holding}
          cashOut={q.cashOut}
          onPick={(slot) => void flow.open(slot)}
          onClose={() => void flow.close()}
          onCustom={() => setSheet("stake")}
          onClosePart={() => setSheet("part")}
          exitLine={position ? exitLine(position.exit, position.payout) : null}
          onExit={() => setSheet("exit")}
        />
      </View>
      {sheet === "stake" ? (
        <StakeSheet
          current={stake}
          min={t.terms?.minStake ?? MIN_STAKE}
          max={t.terms?.maxStake ?? stake}
          balance={t.balance}
          onPick={(s) => setStoredStake(Number(s))}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "part" && t.position && q.latest.current.close ? (
        <CashOutSheet
          shares={t.position.payout}
          bidE6={q.latest.current.close.bidE6}
          onPick={(pct) => void flow.close(pct)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "exit" && position && closeQuote && !closeQuote.refusal && exits.bounds ? (
        <ExitSheet
          shares={position.payout}
          nowBidE6={Number(closeQuote.bidE6)}
          exit={position.exit}
          bounds={exits.bounds}
          pending={exits.pending}
          onSet={(prices) => void setExit(prices)}
          onClose={() => setSheet(null)}
        />
      ) : null}
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
  coach: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZE.gutter,
    paddingBottom: SPACE.sm,
  },
});
