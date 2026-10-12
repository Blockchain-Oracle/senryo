"use client";
/**
 * A ride's exit (R3.12, R5.5; Codex direction 11 §3): take-profit and stop as moves from the entry, each with the
 * price it becomes; the trail's distance behind the best price, flooring at break-even; one signature sets them all
 * on chain, where the relay's watcher fires them with the app closed. Moves past the knock-out aren't offered.
 */
import { RIDE_EXIT_MOVES_BPS, RIDE_TRAIL_STEPS_BPS, trailText, unitOf } from "@senryo/calls";
import { priceText, type RideExitLevels } from "@senryo/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";

const BPS = 10_000n;

export interface RideExitModalProps {
  symbol: string;
  isLong: boolean;
  entryE8: bigint;
  koE8: bigint;
  breakEvenE8: bigint;
  exit: RideExitLevels | null;
  pending: boolean;
  onSet: (levels: RideExitLevels) => void;
  onClose: () => void;
}

const at = (entry: bigint, bps: number, up: boolean) => (entry * (BPS + (up ? 1n : -1n) * BigInt(bps))) / BPS;

function Chips({
  label,
  values,
  chosen,
  word,
  onPick,
}: {
  label: string;
  values: readonly { key: number; text: string; sub: string }[];
  chosen: number | null;
  word: string;
  onPick: (k: number | null) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-meta text-text-3 uppercase tracking-wide">{label}</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={chosen === null}
          className="terminal-preset px-3"
          onClick={() => onPick(null)}
        >
          Off
        </button>
        {values.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={chosen === v.key}
            aria-label={`${word} ${v.text}, ${v.sub}`}
            className="terminal-preset flex flex-col px-3 leading-tight"
            onClick={() => {
              fire("tick", { cue: "tap" });
              onPick(v.key);
            }}
          >
            <span>{v.text}</span>
            <span className="text-meta text-text-3">{v.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RideExitModal(p: RideExitModalProps) {
  const unit = unitOf(p.symbol);
  /** A set level back to its step (the way it was set here); one set elsewhere reads as off until changed. */
  const pickOf = (e8: bigint | undefined, profitSide: boolean) =>
    e8 && e8 > 0n ? (RIDE_EXIT_MOVES_BPS.find((b) => at(p.entryE8, b, profitSide === p.isLong) === e8) ?? null) : null;
  const [tp, setTp] = useState<number | null>(pickOf(p.exit?.takeProfitE8, true));
  const [sl, setSl] = useState<number | null>(pickOf(p.exit?.stopLossE8, false));
  const [trail, setTrail] = useState<number | null>(p.exit && p.exit.trailBps > 0 ? p.exit.trailBps : null);
  const beyondKo = (bps: number) => {
    const price = at(p.entryE8, bps, !p.isLong);
    return p.isLong ? price <= p.koE8 : price >= p.koE8;
  };
  const tpChips = RIDE_EXIT_MOVES_BPS.map((b) => ({
    key: b,
    text: `+${trailText(b)}`,
    sub: priceText(at(p.entryE8, b, p.isLong), unit),
  }));
  const slChips = RIDE_EXIT_MOVES_BPS.filter((b) => !beyondKo(b)).map((b) => ({
    key: b,
    text: `−${trailText(b)}`,
    sub: priceText(at(p.entryE8, b, !p.isLong), unit),
  }));
  const trailChips = RIDE_TRAIL_STEPS_BPS.map((b) => ({ key: b, text: trailText(b), sub: "behind best" }));
  const levels: RideExitLevels = {
    takeProfitE8: tp === null ? 0n : at(p.entryE8, tp, p.isLong),
    stopLossE8: sl === null ? 0n : at(p.entryE8, sl, !p.isLong),
    floorE8: trail === null ? 0n : p.breakEvenE8,
    trailBps: trail ?? 0,
  };
  const armed = p.exit !== null && (p.exit.takeProfitE8 > 0n || p.exit.stopLossE8 > 0n || p.exit.trailBps > 0);
  const none = tp === null && sl === null && trail === null;
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? undefined : p.onClose())}
      title={`${p.symbol} · Exit`}
      description="It runs on chain with the app closed. Moves are from your entry."
      footer={
        <div className="flex w-full gap-2">
          {armed ? (
            <Button
              variant="ghost"
              disabled={p.pending}
              onClick={() => p.onSet({ takeProfitE8: 0n, stopLossE8: 0n, floorE8: 0n, trailBps: 0 })}
            >
              Remove exit
            </Button>
          ) : null}
          <Button className="flex-1" disabled={p.pending || (none && !armed)} onClick={() => p.onSet(levels)}>
            {p.pending ? "Setting…" : armed ? "Update exit" : "Set exit"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Chips label="Take profit" values={tpChips} chosen={tp} word="Take profit" onPick={setTp} />
        <Chips label="Stop" values={slChips} chosen={sl} word="Stop" onPick={setSl} />
        <Chips label="Trailing stop" values={trailChips} chosen={trail} word="Trail" onPick={setTrail} />
        <p className="text-meta text-text-3">Knocked out at {priceText(p.koE8, unit)} whatever the exit says.</p>
      </div>
    </Modal>
  );
}
