/**
 * Everything the phone terminal opens over itself (R5.4–R5.5): the order settings, closing part of a call or a ride,
 * a call's exit and a ride's exit, and the open positions — sheets in the root layer above the dock (D-321).
 */
import { rideCloseValue } from "@senryo/calls";
import type { useCallFlow, useExitActions } from "@senryo/calls/react";
import { type ExitPrices, hasExit, proceedsFor, type RideExitLevels } from "@senryo/core";
import { PositionsSheet } from "~/features/positions/PositionsSheet";
import { fire } from "~/feedback/fire";
import { notify } from "~/lib/notify";
import { MIN_STAKE } from "./constants";
import { ExitSheet } from "./ExitSheet";
import { OrderSheet } from "./OrderSheet";
import { PartSheet } from "./PartSheet";
import { RideExitSheet } from "./RideExitSheet";
import type { useLiveQuote } from "./useLiveQuote";
import type { RideSide } from "./useRideSide";
import type { TerminalView } from "./useTerminal";
import type { TerminalChoices } from "./useTerminalChoices";
import type { Sheet } from "./useTradePanel";

const HUNDRED = 100n;

async function settle(run: () => Promise<{ kind: string }>, set: boolean, close: () => void) {
  try {
    const r = await run();
    if (r.kind === "cancelled") return;
    close();
    fire("confirm");
    notify(
      set
        ? { title: "Exit set", description: "It runs with the app closed." }
        : { title: "Exit removed", description: "Nothing sells on its own now." },
    );
  } catch (error) {
    fire("fail", { sound: "error" });
    notify({ title: "Couldn't set the exit", description: (error as Error).message, tone: "warning" });
  }
}

export function TerminalSheets(p: {
  sheet: Sheet | null;
  setSheet: (s: Sheet | null) => void;
  ride: boolean;
  t: TerminalView;
  q: ReturnType<typeof useLiveQuote>;
  flow: ReturnType<typeof useCallFlow>;
  exits: ReturnType<typeof useExitActions>;
  side: RideSide;
  choices: TerminalChoices;
}) {
  const { t, q, side, choices, sheet } = p;
  const close = () => p.setSheet(null);
  const position = t.position;
  const bid = q.latest.current.close;
  const held = side.held;
  const rideClose = side.live.latest.current;
  if (sheet === "order") {
    return (
      <OrderSheet
        symbol={t.symbol}
        available={t.balance}
        onClose={close}
        ride={
          p.ride && side.terms && side.market
            ? {
                symbol: t.symbol,
                markE8: rideClose.markE8,
                margin: choices.margin,
                leverageBps: side.leverageBps,
                maxLeverageBps: side.market.maxLeverageBps,
                leverageOnX: choices.leverageOnX,
                trailBps: choices.rideTrailBps,
                terms: side.terms,
                onMargin: choices.setMargin,
                onLeverage: choices.setLeverageX,
                onTrail: choices.setRideTrailBps,
              }
            : null
        }
        call={{
          symbol: t.symbol,
          mode: choices.mode,
          offer: q.offer,
          quotes: q.latest.current,
          lineE8: t.k,
          stake: choices.stake,
          min: t.terms?.minStake ?? MIN_STAKE,
          max: t.terms?.maxStake ?? choices.stake,
          trailCents: choices.callTrailCents,
          onMode: choices.setMode,
          onStake: choices.setStake,
          onTrail: choices.setCallTrailCents,
        }}
      />
    );
  }
  if (sheet === "part" && position && bid) {
    return (
      <PartSheet
        title="Cash out"
        amountAt={(pct) => (bid.refusal ? null : proceedsFor((position.payout * pct) / HUNDRED, bid.bidE6))}
        onPick={(pct) => void p.flow.close(pct)}
        onClose={close}
      />
    );
  }
  if (sheet === "ride-part" && held && held.entryE8 !== null && rideClose.markE8 !== null && side.terms) {
    const value = rideCloseValue(held, rideClose.markE8, side.terms.takerFeeBps, side.terms, t.now).value;
    return (
      <PartSheet
        title="Close"
        amountAt={(pct) => (value * pct) / HUNDRED}
        onPick={(pct) => void side.flow.close(pct)}
        onClose={close}
      />
    );
  }
  if (sheet === "exit" && position && bid && !bid.refusal && p.exits.bounds) {
    return (
      <ExitSheet
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
    );
  }
  if (sheet === "ride-exit" && held && held.entryE8 !== null && held.koE8 !== null) {
    return (
      <RideExitSheet
        symbol={t.symbol}
        isLong={held.isLong}
        entryE8={held.entryE8}
        koE8={held.koE8}
        breakEvenE8={rideClose.breakEvenE8 ?? held.entryE8}
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
    );
  }
  if (sheet === "positions") return <PositionsSheet onClose={close} />;
  return null;
}
