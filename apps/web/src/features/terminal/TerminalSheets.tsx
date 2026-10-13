"use client";
/**
 * Everything the terminal opens over itself (R5.4–R5.5): the order settings (a call's or a ride's), closing part of
 * a call or a ride, a call's exit and a ride's exit, the markets and the open positions — centred modals and right
 * drawers on the web (D-190).
 */
import type { CallWindowView, useCallFlow, useExitActions } from "@senryo/calls/react";
import { type ExitPrices, hasExit, proceedsFor, type RideExitLevels } from "@senryo/core";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { PositionsPanel } from "@/features/positions/PositionsPanel";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { CallSettings } from "./CallSettings";
import { MIN_STAKE } from "./constants";
import { ExitModal } from "./ExitModal";
import { MarketPicker } from "./MarketPicker";
import { PartModal } from "./PartModal";
import { RideExitModal } from "./RideExitModal";
import { RideSettings } from "./RideSettings";
import type { useLiveQuote } from "./useLiveQuote";
import type { RideSide } from "./useRideSide";
import type { TerminalChoices } from "./useTerminalChoices";
import type { Sheet } from "./useTradePanel";

const HUNDRED = 100n;

export interface TerminalSheetsProps {
  symbol: string;
  sheet: Sheet | null;
  setSheet: (s: Sheet | null) => void;
  ride: boolean;
  t: CallWindowView;
  q: ReturnType<typeof useLiveQuote>;
  flow: ReturnType<typeof useCallFlow>;
  exits: ReturnType<typeof useExitActions>;
  side: RideSide;
  choices: TerminalChoices;
}

async function settle(run: () => Promise<{ kind: string }>, set: boolean, close: () => void) {
  try {
    const r = await run();
    if (r.kind === "cancelled") return;
    close();
    fire("snap");
    notify(
      set
        ? { title: "Exit set", description: "It runs with the app closed." }
        : { title: "Exit removed", description: "Nothing sells on its own now." },
    );
  } catch (error) {
    fire("fail");
    notify({ title: "Couldn't set the exit", description: (error as Error).message, tone: "warning" });
  }
}

export function TerminalSheets(p: TerminalSheetsProps) {
  const { t, q, side, choices } = p;
  const close = () => p.setSheet(null);
  const position = t.position;
  const bid = q.latest.current.close;
  const held = side.held;
  const rideMark = side.live.latest.current.markE8;
  const rideClose = side.live.close.get().units;
  return (
    <>
      <Modal
        open={p.sheet === "order"}
        onOpenChange={(o) => p.setSheet(o ? "order" : null)}
        title={`${p.symbol} · ${p.ride ? "Ride" : "Call"} settings`}
        footer={
          <Button className="w-full" onClick={close}>
            Done
          </Button>
        }
      >
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {p.ride && side.terms && side.market ? (
            <RideSettings
              symbol={p.symbol}
              markE8={rideMark}
              margin={choices.margin}
              leverageBps={side.leverageBps}
              maxLeverageBps={side.market.maxLeverageBps}
              leverageOnX={choices.leverageOnX}
              trailBps={choices.rideTrailBps}
              terms={side.terms}
              available={t.balance}
              onMargin={choices.setMargin}
              onLeverage={choices.setLeverageX}
              onTrail={choices.setRideTrailBps}
            />
          ) : (
            <CallSettings
              symbol={p.symbol}
              mode={choices.mode}
              offer={q.offer}
              quotes={q.latest.current}
              lineE8={t.k}
              stake={choices.stake}
              min={t.terms?.minStake ?? MIN_STAKE}
              max={t.terms?.maxStake ?? choices.stake}
              trailCents={choices.callTrailCents}
              available={t.balance}
              onMode={choices.setMode}
              onStake={choices.setStake}
              onTrail={choices.setCallTrailCents}
            />
          )}
        </div>
      </Modal>
      {p.sheet === "part" && position && bid ? (
        <PartModal
          title="Cash out"
          amountAt={(pct) => (bid.refusal ? null : proceedsFor((position.payout * pct) / HUNDRED, bid.bidE6))}
          onPick={(pct) => void p.flow.close(pct)}
          onClose={close}
        />
      ) : null}
      {p.sheet === "ride-part" && held ? (
        <PartModal
          title="Close"
          amountAt={(pct) => (rideClose === null ? null : (rideClose * pct) / HUNDRED)}
          onPick={(pct) => void side.flow.close(pct)}
          onClose={close}
        />
      ) : null}
      {p.sheet === "exit" && position && bid && !bid.refusal && p.exits.bounds ? (
        <ExitModal
          shares={position.payout}
          nowBidE6={Number(bid.bidE6)}
          exit={position.exit}
          bounds={p.exits.bounds}
          pending={p.exits.pending}
          onSet={(prices: ExitPrices) =>
            void settle(() => p.exits.set(position.ticketId, prices), hasExit(prices), close)
          }
          onClose={close}
        />
      ) : null}
      {p.sheet === "ride-exit" && held && held.entryE8 !== null && held.koE8 !== null ? (
        <RideExitModal
          symbol={p.symbol}
          isLong={held.isLong}
          entryE8={held.entryE8}
          koE8={held.koE8}
          breakEvenE8={side.live.latest.current.breakEvenE8 ?? held.entryE8}
          exit={held.exit}
          pending={side.flow.arming}
          onSet={(levels: RideExitLevels) =>
            void settle(
              () => side.flow.setExit(held.rideId, levels),
              levels.takeProfitE8 > 0n || levels.stopLossE8 > 0n || levels.trailBps > 0,
              close,
            )
          }
          onClose={close}
        />
      ) : null}
      <SlideOver
        open={p.sheet === "markets"}
        onOpenChange={(o) => p.setSheet(o ? "markets" : null)}
        title="Markets"
        wide
      >
        <MarketPicker selected={p.symbol} onPick={close} />
      </SlideOver>
      <SlideOver
        open={p.sheet === "positions"}
        onOpenChange={(o) => p.setSheet(o ? "positions" : null)}
        title="Open positions"
      >
        <PositionsPanel onPick={() => p.setSheet(null)} />
      </SlideOver>
    </>
  );
}
