"use client";
/**
 * The terminal at `/app/trade/<symbol>/` (pivot S6.5; the phone's terminal with Owarine's web workspace): the whole
 * stage is the chart — K, your side's zone, the rolling pill, the reactions — with the market chip and the lanes over
 * it, the distance to the line and the crowd under it, and the call panel beside it (below it under 1024 px). Ticks
 * never render React (`useLiveQuote` → live values and the chart's ref); the screen renders once a second for the
 * countdown and on events. The call flow is `@senryo/calls` `useCallFlow`, the phone's own.
 */
import { DEFAULT_CADENCE, useCallFlow, useCallWindow } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec } from "@senryo/config";
import { useWindowLoad } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { LiveText } from "@/components/kit/live-text";
import { shortcutBlocked } from "@/components/shell/Rail";
import { SlideOver } from "@/components/ui/drawer";
import { MarketList } from "@/features/markets/MarketList";
import { useAccount } from "@/lib/account/provider";
import { hasAcknowledgedTerms } from "@/lib/account/terms";
import { ROUTES } from "@/lib/constants/routes";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { TERMINAL_STORAGE, useStoredString } from "@/lib/terminal/stored";
import { CallPanel } from "./CallPanel";
import { CashOutModal } from "./CashOutModal";
import { CrowdLine } from "./CrowdLine";
import type { ChartFrame } from "./chart/chart-engine";
import { LiveChart } from "./chart/LiveChart";
import { DEFAULT_STAKE, MIN_STAKE } from "./constants";
import { ReactionOverlay, type ReactionOverlayHandle } from "./ReactionOverlay";
import { StakeModal } from "./StakeModal";
import { TerminalTop } from "./TerminalTop";
import { useLiveQuote } from "./useLiveQuote";
import { useReactions } from "./useReactions";
import "./terminal.css";
import "./reactions.css";

const WHOLE_NUMBER = /^\d+$/;

function useTerminalChoices() {
  const [storedCadence, setCadence] = useStoredString(TERMINAL_STORAGE.cadence);
  const [storedStake, setStake] = useStoredString(TERMINAL_STORAGE.stake);
  const cadence = CADENCES_SEC.find((c) => String(c) === storedCadence) ?? DEFAULT_CADENCE;
  const stake = storedStake && WHOLE_NUMBER.test(storedStake) ? BigInt(storedStake) : DEFAULT_STAKE;
  return {
    cadence,
    stake,
    setCadence: (c: CadenceSec) => setCadence(String(c)),
    setStake: (s: bigint) => setStake(String(s)),
  };
}

export function TerminalScreen({ symbol }: { symbol: string }) {
  const account = useAccount();
  const choices = useTerminalChoices();
  const t = useCallWindow(symbol, choices.cadence, account.hint?.address);
  const load = useWindowLoad(t.window.expiry > 0 ? t.window.expiry : undefined);
  const q = useLiveQuote(t, choices.stake, "value" in load ? load.value : undefined);
  const reactions = useRef<ReactionOverlayHandle>(null);
  const onFrame = useRef((frame: ChartFrame | null) => reactions.current?.frame(frame));
  useReactions(symbol, q.onTick, reactions);
  const [open, setOpen] = useState<"stake" | "part" | "markets" | null>(null);
  const flow = useCallFlow({
    view: t,
    caller: account,
    stake: choices.stake,
    latest: q.latest,
    upBand: q.upBand,
    downBand: q.downBand,
    effects: {
      cue: (c) =>
        c === "press"
          ? fire("press")
          : c === "fail"
            ? fire("fail")
            : fire("filled", { cue: c === "filled-close" ? "close" : "open" }),
      notify: (n) => notify({ ...n, tone: "warning" }),
      gate: () => {
        if (hasAcknowledgedTerms(account.hint?.address)) return true;
        notify({
          title: "Agree to the terms first",
          description: "One step before any money moves.",
          action: { label: "Open setup", onClick: () => window.location.assign(ROUTES.setup) },
          tone: "warning",
        });
        return false;
      },
      needAccount: () =>
        notify({
          title: "Sign in to make a call",
          description: "Your passkey is your account.",
          action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
        }),
    },
  });

  // ↑ Up, ↓ Down, C cash out — when nothing else holds the keyboard.
  const keys = useRef({ flow, holding: flow.holding });
  keys.current = { flow, holding: flow.holding };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shortcutBlocked(event)) return;
      const { flow: f, holding } = keys.current;
      if (!holding && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        void f.open(event.key === "ArrowUp" ? "up" : "down");
      } else if (holding && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void f.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeQuote = q.latest.current.close;
  return (
    <div className="terminal-surface">
      <section className="terminal-stage" aria-label={`${symbol} live`}>
        <TerminalTop t={t} onPickMarket={() => setOpen("markets")} onCadence={choices.setCadence} />
        <div className="terminal-chart">
          <LiveChart
            symbol={symbol}
            overlay={q.overlay}
            waiting={`Waiting for ${symbol}…`}
            onFrame={onFrame}
            label={`${symbol} live price`}
          />
          <ReactionOverlay ref={reactions} />
        </div>
        <div className="terminal-under">
          <LiveText
            value={q.lineText}
            placeholder="Waiting for this window’s opening price"
            className="terminal-distance tnum"
          />
          <CrowdLine windowId={t.window.windowId} />
        </div>
      </section>
      <aside className="terminal-side" aria-label="Call">
        <CallPanel
          state={flow.panel}
          stake={choices.stake}
          balance={t.balance}
          onStake={choices.setStake}
          upOdds={q.upLine}
          downOdds={q.downLine}
          holding={flow.holding}
          cashOut={q.cashOut}
          onUp={() => void flow.open("up")}
          onDown={() => void flow.open("down")}
          onClose={() => void flow.close()}
          onCustom={() => setOpen("stake")}
          onClosePart={() => setOpen("part")}
        />
      </aside>
      {open === "stake" ? (
        <StakeModal
          current={choices.stake}
          min={t.terms?.minStake ?? MIN_STAKE}
          max={t.terms?.maxStake ?? choices.stake}
          balance={t.balance}
          onPick={choices.setStake}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "part" && t.position && closeQuote ? (
        <CashOutModal
          shares={t.position.payout}
          bidE6={closeQuote.bidE6}
          onPick={(pct) => void flow.close(pct)}
          onClose={() => setOpen(null)}
        />
      ) : null}
      <SlideOver open={open === "markets"} onOpenChange={(o) => setOpen(o ? "markets" : null)} title="Markets">
        <MarketList />
      </SlideOver>
    </div>
  );
}
