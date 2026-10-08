/**
 * The terminal (S5; Tradash's phone workspace on Senryo's windows): top bar, the full-bleed live chart with K, the
 * distance to the line, and the call panel. Ticks never render React here (`useLiveQuote` → shared values); the screen
 * renders on events and once a second for the countdown. A call is followed from tap to fill on the stream.
 */
import type { IntentStatus } from "@senryo/api-client";
import { formatUnits } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useIntentStatus } from "@senryo/query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMMKVNumber } from "react-native-mmkv";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { LiveText } from "~/components/kit/LiveText";
import { useDockInset } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useCallActions } from "../calls/useCall";
import { CallPanel, type PanelState } from "./CallPanel";
import { LiveChart } from "./chart/LiveChart";
import { MarketsSheet } from "./MarketsSheet";
import { clockText, TerminalTop } from "./TerminalTop";
import { useLiveQuote } from "./useLiveQuote";
import { useMoveFeedback } from "./useMoveFeedback";
import { useTerminal } from "./useTerminal";

const DEFAULT_STAKE = 5_000_000;
const CLOCK_SYNC_MS = 5_000;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SETTLED = new Set(["filled", "refused", "failed"]);

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
  const q = useLiveQuote(t, stake);
  const heldBand = t.position && t.position.state === "open" ? t.series?.bands[t.position.band] : undefined;
  useMoveFeedback(t.symbol, heldBand?.kind === "up" ? "up" : heldBand?.kind === "down" ? "down" : null);
  const actions = useCallActions();
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<{ digest: `0x${string}`; label: string; kind: "open" | "close" } | null>(null);
  const intent = useIntentStatus(pending?.digest);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const offsetMs = useSharedValue(live.clock.offset);

  useEffect(() => {
    const id = setInterval(() => {
      offsetMs.value = live.clock.offset;
    }, CLOCK_SYNC_MS);
    return () => clearInterval(id);
  }, [live, offsetMs]);

  // A call settles into a result: filled (sound and haptic), refused or failed (said plainly).
  const status: IntentStatus | null = "value" in intent ? intent.value : null;
  useEffect(() => {
    if (!status || !SETTLED.has(status.state)) return;
    if (status.state === "filled") {
      fire("filled", { cue: pendingRef.current?.kind === "close" ? "close" : "open" });
      onFilled?.();
    } else {
      fire("fail", { sound: "error" });
      notify({
        title: status.state === "refused" ? "Call refused" : "Call didn't go through",
        description: status.reason ?? "Your stake was not taken.",
        tone: "warning",
      });
    }
    setPending(null);
  }, [status, onFilled]);

  const stale = live.prices.isStale(t.symbol, Date.now());
  const panel: PanelState = pending
    ? { kind: "pending", status, label: pending.label }
    : !t.window.trading
      ? { kind: "locked", text: `Calls closed · next opens in ${clockText(t.window.expiry - t.now)}` }
      : stale
        ? { kind: "stale" }
        : t.k === undefined
          ? { kind: "no-price" }
          : { kind: "ready" };

  const guard = (): boolean => {
    if (!t.owner) {
      router.push(accountRequiredRoute("make a call"));
      return false;
    }
    if (!actions.ready) return false;
    return true;
  };

  const open = async (side: "up" | "down") => {
    if (!guard()) return;
    const band = side === "up" ? q.upBand : q.downBand;
    const quote = side === "up" ? q.latest.current.up : q.latest.current.down;
    if (!band || !quote || quote.refusal) {
      notify({ title: "Not priced right now", description: "Try the next window.", tone: "warning" });
      return;
    }
    if (t.balance !== undefined && t.balance < stake) {
      notify({
        title: "Not enough dollars",
        description: `You have $${formatUnits(t.balance, DOLLAR_DECIMALS, CENTS)}.`,
        tone: "warning",
      });
      return;
    }
    const label = side === "up" ? "Up" : "Down";
    fire("press");
    try {
      const r = await actions.open({
        window: t.window,
        band: band.index,
        bandLabel: label,
        stake,
        payoutQuote: quote.payout,
      });
      if (r.kind === "sent") setPending({ digest: r.status.digest, label: `Opening ${label}…`, kind: "open" });
    } catch (error) {
      fire("fail");
      notify({ title: "Couldn't place the call", description: (error as Error).message, tone: "warning" });
    }
  };

  const close = async () => {
    const position = t.position;
    const quote = q.latest.current.close;
    if (!guard() || !position || !quote || quote.refusal) return;
    fire("press");
    try {
      const r = await actions.close({
        window: t.window,
        ticketId: position.ticketId,
        band: position.band,
        shares: position.payout,
        proceedsQuote: quote.proceeds,
      });
      if (r.kind === "sent") setPending({ digest: r.status.digest, label: "Cashing out…", kind: "close" });
    } catch (error) {
      fire("fail");
      notify({ title: "Couldn't cash out", description: (error as Error).message, tone: "warning" });
    }
  };

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
        <LiveChart symbol={t.symbol} overlay={q.overlay} waiting={`Waiting for ${t.symbol}…`} />
      </View>
      <LiveText text={q.lineText} style={[TYPE.caption, styles.line, { color: color.inkMuted }]} />
      <View style={{ paddingBottom: bottom }}>
        <CallPanel
          state={panel}
          stake={stake}
          balance={t.balance}
          onStake={(s) => setStoredStake(Number(s))}
          upOdds={q.upLine}
          downOdds={q.downLine}
          holding={t.position !== undefined && t.position.state !== "committed"}
          cashOut={q.cashOut}
          onUp={() => void open("up")}
          onDown={() => void open("down")}
          onClose={() => void close()}
        />
      </View>
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
