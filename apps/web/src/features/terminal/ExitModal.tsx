"use client";
/**
 * A call's exit (S8.4, D-292; the phone's `ExitSheet`, a centred modal on the web): take profit, a stop and a trail,
 * each set in what the call would cash out for — Off, a preset from today's value, then the stepper (21st #29940) —
 * and "never below" under a stop or a trail. It runs with the app closed and sells every share left; the price that
 * fills decides, so it never sells outside what is set here.
 */
import {
  type BidBounds,
  type ExitState,
  type ExitValues,
  exitPricesOf,
  exitProblem,
  exitStep,
  exitStepCents,
  exitValuesOf,
  floorStart,
  STOP_STEPS_BPS,
  TAKE_PROFIT_STEPS_BPS,
  TRAIL_CENTS,
  TRAIL_MAX_CENTS,
  valueAtBid,
} from "@senryo/calls";
import { type ExitPrices, formatUnits, hasExit } from "@senryo/core";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const CENT = 10_000n;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;
const toCents = (v: bigint) => Number(v / CENT);
const fromCents = (c: number) => BigInt(c) * CENT;
const centsText = (c: number) => dollars(fromCents(c));

function Chip(p: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={p.on}
      aria-label={p.label}
      className="terminal-preset"
      onClick={() => {
        fire("tick", { cue: "tap" });
        p.onClick();
      }}
    >
      {p.children}
    </button>
  );
}

function Row(p: { title: string; hint: string; chips: ReactNode; stepper: ReactNode | null }) {
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-row-title">{p.title}</span>
        <span className="text-meta text-text-3">{p.hint}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{p.chips}</div>
      {p.stepper}
    </div>
  );
}

export function ExitModal(p: {
  shares: bigint;
  nowBidE6: number;
  exit: ExitState | null;
  bounds: BidBounds;
  pending: boolean;
  onSet: (prices: ExitPrices) => void;
  onClose: () => void;
}) {
  const now = valueAtBid(p.nowBidE6, p.shares);
  const top = toCents(valueAtBid(p.bounds.maxBidE6, p.shares));
  const bottom = Math.max(1, toCents(valueAtBid(p.bounds.minBidE6, p.shares)));
  const nowCents = toCents(now);
  const step = exitStepCents(top);
  const [v, setV] = useState<ExitValues>(() => exitValuesOf(p.exit, p.shares));
  const set = (patch: Partial<ExitValues>) => setV((old) => ({ ...old, ...patch }));
  const prices = exitPricesOf(v, p.shares);
  const problem = exitProblem(prices, p.shares, p.nowBidE6, p.bounds);
  const armed = p.exit !== null && hasExit(p.exit);

  const takeChips = TAKE_PROFIT_STEPS_BPS.flatMap((bps) => {
    const value = exitStep(now, bps, p.shares, p.bounds);
    return value === null
      ? []
      : [
          <Chip key={String(bps)} on={v.takeProfit === value} onClick={() => set({ takeProfit: value })}>
            {dollars(value)}
          </Chip>,
        ];
  });
  const stopChips = STOP_STEPS_BPS.flatMap((bps) => {
    const value = exitStep(now, bps, p.shares, p.bounds);
    return value === null
      ? []
      : [
          <Chip key={String(bps)} on={v.stopLoss === value} onClick={() => set({ stopLoss: value })}>
            {dollars(value)}
          </Chip>,
        ];
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && p.onClose()}
      title="Exit"
      description={`Worth ${dollars(now)} now · runs with the app closed`}
    >
      <div className="flex flex-col divide-y divide-border">
        <Row
          title="Take profit"
          hint="Sells when it's worth at least"
          chips={[
            <Chip key="off" on={v.takeProfit === null} onClick={() => set({ takeProfit: null })}>
              Off
            </Chip>,
            ...takeChips,
          ]}
          stepper={
            v.takeProfit === null ? null : (
              <QuantityStepper
                label="Take profit"
                value={toCents(v.takeProfit)}
                min={Math.min(nowCents + 1, top)}
                max={top}
                step={step}
                format={centsText}
                onValueChange={(c) => set({ takeProfit: fromCents(c) })}
              />
            )
          }
        />
        <Row
          title="Stop"
          hint="Sells when it's worth at most"
          chips={[
            <Chip key="off" on={v.stopLoss === null} onClick={() => set({ stopLoss: null })}>
              Off
            </Chip>,
            ...stopChips,
          ]}
          stepper={
            v.stopLoss === null ? null : (
              <QuantityStepper
                label="Stop"
                value={toCents(v.stopLoss)}
                min={bottom}
                max={Math.max(bottom, nowCents - 1)}
                step={step}
                format={centsText}
                onValueChange={(c) => set({ stopLoss: fromCents(c) })}
              />
            )
          }
        />
        <Row
          title="Trail"
          hint="Sells after a drop from its best, a share"
          chips={[
            <Chip key="off" on={v.trailCents === null} onClick={() => set({ trailCents: null })}>
              Off
            </Chip>,
            ...TRAIL_CENTS.map((c) => (
              <Chip key={c} on={v.trailCents === c} onClick={() => set({ trailCents: c })} label={`Trail ${c} cents`}>
                {c}¢
              </Chip>
            )),
          ]}
          stepper={
            v.trailCents === null ? null : (
              <QuantityStepper
                label="Trail"
                value={v.trailCents}
                min={1}
                max={TRAIL_MAX_CENTS}
                format={(c) => `${c}¢`}
                onValueChange={(c) => set({ trailCents: c })}
              />
            )
          }
        />
        {v.stopLoss !== null || v.trailCents !== null ? (
          <Row
            title="Never below"
            hint="The least a stop or trail sells for"
            chips={[
              <Chip key="off" on={v.floor === null} onClick={() => set({ floor: null })}>
                Off
              </Chip>,
              <Chip key="half" on={v.floor !== null} onClick={() => set({ floor: floorStart(now) })}>
                Set
              </Chip>,
            ]}
            stepper={
              v.floor === null ? null : (
                <QuantityStepper
                  label="Never below"
                  value={toCents(v.floor)}
                  min={bottom}
                  max={Math.max(bottom, v.stopLoss === null ? nowCents - 1 : toCents(v.stopLoss))}
                  step={step}
                  format={centsText}
                  onValueChange={(c) => set({ floor: fromCents(c) })}
                />
              )
            }
          />
        ) : null}
      </div>
      <p className={cn("min-h-5 pt-2 text-meta", problem ? "text-down" : "text-text-3")} role="status">
        {problem ?? "Sells every share left at the next price. That price decides; nothing sells outside these."}
      </p>
      <div className="flex gap-2 pt-3">
        {armed ? (
          <button
            type="button"
            className="terminal-part flex-1"
            disabled={p.pending}
            onClick={() => p.onSet({ takeProfitE6: 0, stopLossE6: 0, floorE6: 0, trailE6: 0 })}
          >
            Remove
          </button>
        ) : null}
        <button
          type="button"
          className="terminal-cashout flex-[2] justify-center"
          disabled={p.pending || problem !== null || !hasExit(prices)}
          onClick={() => {
            fire("press", { cue: "tap" });
            p.onSet(prices);
          }}
        >
          {p.pending ? "Setting…" : armed ? "Update exit" : "Set exit"}
        </button>
      </div>
    </Modal>
  );
}
