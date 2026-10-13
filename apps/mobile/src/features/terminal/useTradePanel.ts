/**
 * What the active instrument puts on the phone terminal (R5.4–R5.6; the web's `useTradePanel`): the trade buttons'
 * props (UP / DOWN or TRAIL / CLOSE), the order stack's heading and rows, the chart's overlay (a derived value over
 * the call's and the ride's, read on the UI thread) and the reaction feed.
 */
import { CALL_MODES, CENT_E6, type ChartOverlay, chartFrame, dollars, type QuoteTick, trailText } from "@senryo/calls";
import type { useCallFlow, useExitActions } from "@senryo/calls/react";
import { rideFee, rideNotional } from "@senryo/core";
import { useCallback, useEffect, useRef } from "react";
import { type SharedValue, useDerivedValue, useSharedValue } from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { HIDDEN_AMOUNT, useHideBalances } from "~/lib/hide-balances";
import { notify } from "~/lib/notify";
import type { StackRow } from "./OrderStack";
import type { Side, TradeButtonsProps } from "./TradeButtons";
import type { useLiveQuote } from "./useLiveQuote";
import type { RideSide } from "./useRideSide";
import type { TerminalView } from "./useTerminal";
import type { TerminalChoices } from "./useTerminalChoices";

const LEVERAGE_ONE = 10_000;
const CALL_WORD = "Cash out";
const RIDE_WORD = "Close";

type Quote = ReturnType<typeof useLiveQuote>;
export type Sheet = "order" | "part" | "exit" | "ride-part" | "ride-exit" | "positions";

function callSides(q: Quote): readonly [Side] | readonly [Side, Side] {
  const [a, b] = q.offer;
  const first: Side = { kind: a?.band.kind ?? "up", label: a?.label ?? "", line: q.firstLine };
  return b ? [first, { kind: b.band.kind, label: b.label, line: q.secondLine }] : [first];
}

export function useTradePanel(i: {
  ride: boolean;
  t: TerminalView;
  q: Quote;
  flow: ReturnType<typeof useCallFlow>;
  exits: ReturnType<typeof useExitActions>;
  side: RideSide;
  choices: TerminalChoices;
  open: (s: Sheet) => void;
}) {
  const { ride, t, q, flow, exits, side, choices } = i;
  const position = t.position;
  const active = useRef(ride);
  active.current = ride;
  const rideOn = useSharedValue(ride);
  useEffect(() => {
    rideOn.value = ride;
  }, [ride, rideOn]);
  const callOverlay = q.overlay;
  const rideOverlay = side.live.overlay;
  // The chart reads whichever instrument is on, with the tap's pending entry and the PnL masked (`chartFrame`).
  const [hidden] = useHideBalances();
  const masking = useSharedValue(hidden);
  const pendingEntry = ride ? side.flow.pendingEntry : flow.pendingEntry;
  const pending = useSharedValue(pendingEntry);
  useEffect(() => {
    masking.value = hidden;
    pending.value = pendingEntry;
  }, [hidden, masking, pendingEntry, pending]);
  const overlay: SharedValue<ChartOverlay | null> = useDerivedValue(() =>
    chartFrame(
      rideOn.value ? rideOverlay.value : callOverlay.value,
      pending.value,
      masking.value ? HIDDEN_AMOUNT : null,
    ),
  );

  const armed = (title: string) => {
    fire("confirm");
    notify({ title, description: "It runs with the app closed." });
  };
  const armCallTrail = async () => {
    const floor = q.trailFloor.current;
    if (!position || floor === null) return;
    const e = position.exit;
    fire("press");
    try {
      const r = await exits.set(position.ticketId, {
        takeProfitE6: e?.takeProfitE6 ?? 0,
        stopLossE6: e?.stopLossE6 ?? 0,
        floorE6: floor,
        trailE6: choices.callTrailCents * CENT_E6,
      });
      if (r.kind === "sent") armed(`Trailing stop armed · ${t.symbol}`);
    } catch (error) {
      fire("fail", { cue: "error" });
      notify({ title: "Couldn't arm the trail", description: (error as Error).message, tone: "warning" });
    }
  };

  const buttons: TradeButtonsProps = ride
    ? side.flow.holding
      ? {
          instrument: "ride",
          mode: "held",
          closeWord: RIDE_WORD,
          close: side.live.close,
          trailCaption: side.live.trailCaption,
          state: side.live.held,
          busy: side.flow.arming ? "trail" : null,
          held: side.flow.panel.kind === "pending" ? side.flow.panel.label : null,
          onClose: () => void side.flow.close(),
          onClosePart: () => i.open("ride-part"),
          onTrail: () =>
            void side.flow.armTrail().then((ok) => (ok ? armed(`Trailing stop armed · ${t.symbol}`) : undefined)),
          onExit: () => i.open("ride-exit"),
        }
      : {
          instrument: "ride",
          mode: "entry",
          sides: [
            { kind: "up", label: "Up", line: side.live.upLine },
            { kind: "down", label: "Down", line: side.live.downLine },
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
          trailCaption: q.trailCaption,
          state: q.held,
          busy: exits.pending ? "trail" : null,
          held:
            flow.panel.kind === "pending"
              ? flow.panel.label
              : flow.panel.kind === "locked" || flow.panel.kind === "stale"
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
