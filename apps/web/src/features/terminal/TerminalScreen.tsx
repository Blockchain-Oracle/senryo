"use client";
/**
 * The terminal at `/app/trade/<symbol>/` (pivot S6.5 → R5; Tradash's workspace, Owarine's web layout, Codex direction
 * 11): the chart is the stage — the line, its levels and band, the rolling pill, the reactions — with the order stack
 * on its left edge; the market chip, equity and lanes over it. The column (below the chart under 1024 px) holds the
 * open positions over the action group: Call | Ride, one sentence when something holds the buttons, and UP / DOWN that
 * morph into TRAIL / CLOSE while held. Ticks never render React (`useLiveQuote`, `useLiveRide` → live values and the
 * chart's ref); the flows are `@senryo/calls`', the phone's own.
 */
import { ridesOn, sessionHistory } from "@senryo/calls";
import {
  type OfferSlot,
  useCallFlow,
  useCallWindow,
  useExitActions,
  useGuestTap,
  useMarketLine,
  usePriceHealth,
} from "@senryo/calls/react";
import { useRecentCandles, useWindowLoad } from "@senryo/query";
import { useMemo, useRef, useState } from "react";
import { LiveText } from "@/components/kit/live-text";
import { PositionsPanel } from "@/features/positions/PositionsPanel";
import { guestSession, useAppTrader } from "@/lib/account/guest";
import { notify } from "@/lib/notify";
import { tradeToast } from "@/lib/trade-toast";
import { ActionPanel } from "./ActionPanel";
import { BasketMembers } from "./BasketMembers";
import { CrowdLine } from "./CrowdLine";
import type { ChartFrame } from "./chart/chart-engine";
import { SAMPLE_CAPACITY } from "./chart/constants";
import { LiveChart } from "./chart/LiveChart";
import { OrderStack } from "./OrderStack";
import { PositionsPill } from "./PositionsPill";
import { ReactionOverlay, type ReactionOverlayHandle } from "./ReactionOverlay";
import { TerminalSheets } from "./TerminalSheets";
import { TerminalTop } from "./TerminalTop";
import { useLiveQuote } from "./useLiveQuote";
import { useReactions } from "./useReactions";
import { useRideSide } from "./useRideSide";
import { useTerminalChoices } from "./useTerminalChoices";
import { useTerminalEffects } from "./useTerminalEffects";
import { useTerminalKeys } from "./useTerminalKeys";
import { type Sheet, useTradePanel } from "./useTradePanel";
import "./terminal.css";
import "./positions.css";
import "./reactions.css";

export function TerminalScreen({ symbol }: { symbol: string }) {
  // The passkey account, else on Practice the guest's device key (R5.10).
  const trader = useAppTrader();
  const account = trader.caller;
  const choices = useTerminalChoices();
  // A market that doesn't ride shows Call; Ride stays in the switch and says why when tapped.
  const ride = choices.instrument === "ride" && ridesOn(symbol);
  const t = useCallWindow(symbol, choices.cadence, trader.owner);
  // Nothing is asked of the api before the server clock has synced (the static HTML renders at second 0).
  const synced = t.now > 0;
  const load = useWindowLoad(synced ? t.window.expiry : undefined);
  const q = useLiveQuote(
    t,
    choices.stake,
    "value" in load ? load.value : undefined,
    choices.mode,
    choices.callTrailCents,
  );
  const session = useMarketLine(symbol);
  // The chart reads it each frame: not live → its line freezes, dims and shows the age (R1.20).
  const priceHealth = usePriceHealth(symbol);
  const health = useRef({ live: priceHealth.live, tag: priceHealth.tag });
  health.current = { live: priceHealth.live, tag: priceHealth.tag };
  // A closed market still shows its chart: its last session from our candle archive.
  const closed = !session.trading && !session.paused && !session.unlisted;
  const candles = useRecentCandles(symbol, t.now, closed);
  const sessionLine = useMemo(
    () => (closed && "value" in candles ? sessionHistory(candles.value.candles, SAMPLE_CAPACITY) : null),
    [closed, candles],
  );
  const history = useRef(sessionLine);
  history.current = sessionLine;
  const chart = useRef<HTMLDivElement>(null);
  const reactions = useRef<ReactionOverlayHandle>(null);
  const onFrame = useRef((frame: ChartFrame | null) => reactions.current?.frame(frame));
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // A visitor's first tap on Practice starts the guest and places that same trade once its dollars land.
  const placer = useRef<(slot: OfferSlot) => void>(() => undefined);
  const guestTap = useGuestTap({
    owner: trader.owner,
    symbol,
    sessionFor: guestSession,
    place: (slot) => placer.current(slot),
    toast: tradeToast,
  });
  const effects = useTerminalEffects(trader.guest, guestTap);
  const exits = useExitActions(account, choices.cadence);
  const flow = useCallFlow({
    view: t,
    caller: account,
    stake: choices.stake,
    latest: q.latest,
    offer: q.offer,
    effects,
  });
  const side = useRideSide({ symbol, account, choices, active: ride, balance: t.balance, nowSec: t.now, effects });
  placer.current = (slot) => void (ride ? side.flow.open(slot) : flow.open(slot));
  const trade = useTradePanel({ ride, t, q, flow, exits, side, choices, open: setSheet });
  useReactions(symbol, trade.onTick, reactions);
  useTerminalKeys({
    holding: trade.holding,
    trading: session.trading,
    open: (slot) => void (ride ? side.flow.open(slot) : flow.open(slot)),
    close: () => void (ride ? side.flow.close() : flow.close()),
  });
  const pickInstrument = (next: "call" | "ride") => {
    if (next === "ride" && !ridesOn(symbol)) {
      notify({
        title: `Rides aren't available on ${symbol}`,
        description: "Rides are on BTC, ETH, SOL, XRP, BNB, DOGE and HYPE.",
        action: { label: "View ride markets", onClick: () => setSheet("markets") },
      });
      return;
    }
    choices.setInstrument(next);
  };

  return (
    <div className="terminal-surface">
      <section className="terminal-stage" aria-label={`${symbol} live`}>
        <TerminalTop
          t={t}
          ride={ride}
          rideEndsIn={side.flow.endsIn}
          onPickMarket={() => setSheet("markets")}
          onCadence={choices.setCadence}
        />
        <div className="terminal-chart" ref={chart}>
          <LiveChart
            symbol={symbol}
            overlay={trade.overlay}
            waiting={`Waiting for ${symbol}…`}
            onFrame={onFrame}
            health={health}
            history={history}
            label={`${symbol} live price`}
          />
          <ReactionOverlay ref={reactions} />
          <OrderStack
            heading={trade.stack.heading}
            rows={trade.stack.rows}
            bounds={chart}
            onOpen={() => setSheet("order")}
          />
        </div>
        {ride ? null : (
          <div className="terminal-under">
            <LiveText
              value={q.lineText}
              placeholder="Waiting for this window’s opening price"
              className="terminal-distance tnum"
            />
            <CrowdLine windowId={synced ? t.window.windowId : undefined} />
            <BasketMembers symbol={symbol} />
          </div>
        )}
      </section>
      <aside className="terminal-side" aria-label={ride ? "Ride" : "Call"}>
        <PositionsPanel className="terminal-positions" />
        <PositionsPill onOpen={() => setSheet("positions")} />
        <ActionPanel
          symbol={symbol}
          session={session}
          instrument={ride ? "ride" : "call"}
          rides={ridesOn(symbol)}
          onInstrument={pickInstrument}
          state={trade.panel}
          holding={trade.holding}
          quoteNote={ride ? null : q.note}
          buttons={trade.buttons}
        />
      </aside>
      <TerminalSheets
        symbol={symbol}
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
    </div>
  );
}
