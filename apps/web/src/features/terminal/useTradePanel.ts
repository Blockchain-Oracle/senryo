"use client";
/**
 * What the active instrument puts on the terminal (R5.4–R5.6): the trade buttons' props (UP / DOWN or TRAIL / CLOSE),
 * the order stack's heading and rows, the chart's overlay and the reaction feed — a call's from `useLiveQuote`, a
 * ride's from `useLiveRide` — so the screen composes one thing whichever is on.
 */
import { CALL_MODES, CENT_E6, type ChartOverlay, dollars, type QuoteTick, trailText } from "@senryo/calls";
import type { CallWindowView, useCallFlow, useExitActions } from "@senryo/calls/react";
import { rideFee, rideNotional } from "@senryo/core";
import { type RefObject, useCallback, useMemo, useRef } from "react";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import type { StackRow } from "./OrderStack";
import type { Side, TradeButtonsProps } from "./TradeButtons";
import type { useLiveQuote } from "./useLiveQuote";
import type { RideSide } from "./useRideSide";
import type { TerminalChoices } from "./useTerminalChoices";

const LEVERAGE_ONE = 10_000;
const CALL_WORD = "CASH OUT";
const RIDE_WORD = "CLOSE";

type Quote = ReturnType<typeof useLiveQuote>;
type Flow = ReturnType<typeof useCallFlow>;
type Exits = ReturnType<typeof useExitActions>;
/** The call buttons for the mode's offer: Up and Down, Moonshot and Crash, or Range alone. */
function callSides(q: Quote): readonly [Side] | readonly [Side, Side] {
  const [a, b] = q.offer;
  const first: Side = { kind: a?.band.kind ?? "up", label: (a?.label ?? "").toUpperCase(), line: q.firstLine };
  return b ? [first, { kind: b.band.kind, label: b.label.toUpperCase(), line: q.secondLine }] : [first];
}

export type Sheet = "order" | "part" | "exit" | "ride-part" | "ride-exit" | "markets" | "positions";

export function useTradePanel(i: {
  ride: boolean;
  t: CallWindowView;
  q: Quote;
  flow: Flow;
  exits: Exits;
  side: RideSide;
  choices: TerminalChoices;
  open: (s: Sheet) => void;
}) {
  const { ride, t, q, flow, exits, side, choices } = i;
  const active = useRef(ride);
  active.current = ride;
  const position = t.position;

  const armCallTrail = async () => {
    const floor = q.trailFloor.current;
    if (!position || floor === null) return;
    const e = position.exit;
    try {
      const r = await exits.set(position.ticketId, {
        takeProfitE6: e?.takeProfitE6 ?? 0,
        stopLossE6: e?.stopLossE6 ?? 0,
        floorE6: floor,
        trailE6: choices.callTrailCents * CENT_E6,
      });
      if (r.kind === "sent") {
        fire("snap");
        notify({ title: `Trailing stop armed · ${t.symbol}`, description: "It runs with the app closed." });
      }
    } catch (error) {
      fire("fail");
      notify({ title: "Couldn't arm the trail", description: (error as Error).message, tone: "warning" });
    }
  };
  const armRideTrail = async () => {
    if (await side.flow.armTrail()) {
      fire("snap");
      notify({ title: `Trailing stop armed · ${t.symbol}`, description: "It runs with the app closed." });
    }
  };

  const buttons: TradeButtonsProps = ride
    ? side.flow.holding
      ? {
          instrument: "ride",
          mode: "held",
          closeWord: RIDE_WORD,
          close: side.live.close,
          trail: side.live.trail,
          busy: side.flow.arming ? "trail" : null,
          held: side.flow.panel.kind === "pending" ? side.flow.panel.label : null,
          onClose: () => void side.flow.close(),
          onClosePart: () => i.open("ride-part"),
          onTrail: () => void armRideTrail(),
          onExit: () => i.open("ride-exit"),
        }
      : {
          instrument: "ride",
          mode: "entry",
          sides: [
            { kind: "up", label: "UP", line: side.live.upLine },
            { kind: "down", label: "DOWN", line: side.live.downLine },
          ],
          disabled: side.flow.panel.kind !== "ready" || !side.available,
          onPick: (slot) => void side.flow.open(slot),
          onPreview: side.live.setPreview,
        }
    : flow.holding
      ? {
          instrument: "call",
          mode: "held",
          closeWord: CALL_WORD,
          close: q.cashOut,
          trail: q.trail,
          busy: exits.pending ? "trail" : null,
          held:
            flow.panel.kind === "ready"
              ? null
              : flow.panel.kind === "pending"
                ? flow.panel.label
                : "text" in flow.panel
                  ? flow.panel.text
                  : null,
          onClose: () => void flow.close(),
          onClosePart: () => i.open("part"),
          onTrail: () => void armCallTrail(),
          onExit: () => i.open("exit"),
        }
      : {
          instrument: "call",
          mode: "entry",
          sides: callSides(q),
          disabled: flow.panel.kind !== "ready",
          onPick: (slot) => void flow.open(slot),
          onPreview: q.setPreview,
        };

  const callArmed = (position?.exit?.trailE6 ?? 0) > 0;
  const rideArmed = (side.held?.exit?.trailBps ?? 0) > 0;
  const fee = side.market
    ? rideFee(rideNotional(choices.margin, BigInt(side.leverageBps)), BigInt(side.market.takerFeeBps))
    : null;
  const stack: { heading: string; rows: StackRow[] } = ride
    ? {
        heading: "Ride",
        rows: [
          { icon: "coins", label: "Margin", value: dollars(choices.margin) },
          { icon: "gauge", label: "Leverage", value: `${side.leverageBps / LEVERAGE_ONE}×` },
          { icon: "fees", label: "Fees", value: fee === null ? "—" : `${dollars(fee)} open` },
          {
            icon: "trail",
            label: "Trail",
            value: `${trailText(choices.rideTrailBps)} · ${rideArmed ? "Armed" : "Off"}`,
          },
        ],
      }
    : {
        heading: CALL_MODES.find((m) => m.value === choices.mode)?.label ?? "Call",
        rows: [
          { icon: "coins", label: "Stake", value: dollars(choices.stake) },
          { icon: "gauge", label: "Pays", value: q.pays },
          { icon: "fees", label: "Fees", value: q.fees },
          { icon: "exit", label: "Exit", value: `${choices.callTrailCents}¢ trail · ${callArmed ? "Armed" : "Off"}` },
        ],
      };

  // The chart and the reactions read whichever instrument is on, frame by frame.
  const overlay = useMemo<RefObject<ChartOverlay | null>>(
    () => ({
      get current() {
        return active.current ? side.live.overlay.current : q.overlay.current;
      },
    }),
    [side.live.overlay, q.overlay],
  );
  const onTick = useCallback(
    (listener: (tick: QuoteTick) => void) => {
      const a = q.onTick((x) => !active.current && listener(x));
      const b = side.live.onTick((x) => active.current && listener(x));
      return () => {
        a();
        b();
      };
    },
    [q.onTick, side.live.onTick],
  );

  return {
    buttons,
    stack,
    overlay,
    onTick,
    panel: ride ? side.flow.panel : flow.panel,
    holding: ride ? side.flow.holding : flow.holding,
  };
}
