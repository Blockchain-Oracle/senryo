"use client";

import { ScanFace, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Gauge } from "@/components/ui/gauge";
import { ButtonHoldAndRelease } from "@/components/ui/hold-and-release-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { TaskSteps } from "@/components/ui/task-steps";
import { BPS_ONE } from "@/lib/constants/money";
import {
  GAUGE_DANGER_AT,
  GAUGE_PX,
  GAUGE_WARN_AT,
  LEVERAGE_DETENTS,
  LEVERAGE_MIN,
  MARGIN_USE_K,
  PERCENT_MAX,
  TRACE_STEP_MS,
} from "@/lib/constants/ticket";
import { age, amount, pctBps, usd } from "@/lib/format";
import { BALANCE, EXECUTION_STEPS, type SampleMarket, TICKET } from "@/lib/sample";
import { cn } from "@/lib/utils";

type Side = "long" | "short";
const SIDES = [
  { value: "long", label: "LONG" },
  { value: "short", label: "SHORT" },
] as const;

function liquidation6(price6: bigint, lev: number, side: Side): bigint {
  const move = (price6 * TICKET.maintenanceBps) / (BPS_ONE * BigInt(lev));
  return side === "long" ? price6 - move : price6 + move;
}

const marginUse = (lev: number) => Math.min(PERCENT_MAX, Math.max(0, Math.round(PERCENT_MAX - MARGIN_USE_K / lev)));

/** Ticket (D2): side, size, leverage with detents, margin gauge, summary, hold-to-confirm, execution trace. */
export function Ticket({ market, className }: { market: SampleMarket; className?: string }) {
  const [side, setSide] = useState<Side>("long");
  const [lev, setLev] = useState<number>(TICKET.defaultLev);
  const [step, setStep] = useState<number | null>(null);
  const maxLev = Math.min(market.maxLev, TICKET.maxLev);
  const closed = market.session === "SOON" || market.session === "CLOSED";

  useEffect(() => {
    if (step === null || step >= EXECUTION_STEPS.length) return;
    const t = setTimeout(() => setStep(step + 1), TRACE_STEP_MS);
    return () => clearTimeout(t);
  }, [step]);

  const summary = [
    ["NOTIONAL", usd(TICKET.size6 * BigInt(lev), 0)],
    [`FEE ${pctBps(TICKET.feeBps, false)}`, usd(TICKET.fee6)],
    ["FROM", "FREE·TRADE"],
    ["AFTER", usd(BALANCE.freeToTrade6 - TICKET.size6, 0)],
  ] as const;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 border-border border-b">
        <div className="border-border border-r p-3">
          <SegmentedControl label="Side" fill value={side} onValueChange={(v) => setSide(v as Side)} options={SIDES} />
          <div className="mt-3 space-y-2 font-mono text-label">
            <label className="block text-muted-foreground" htmlFor="ticket-size">
              SIZE (USD)
            </label>
            <output
              id="ticket-size"
              className="block rounded-xs border border-border bg-card px-2 py-1.5 text-body text-foreground tabular-nums"
            >
              {amount(TICKET.size6)}
            </output>
            <div className="flex justify-between pt-1 text-muted-foreground">
              <span>LEVERAGE</span>
              <span className="text-foreground">{lev}x</span>
            </div>
            <Slider
              value={[lev]}
              onValueChange={(v) => setLev(v[0] ?? LEVERAGE_MIN)}
              min={LEVERAGE_MIN}
              max={maxLev}
              step={1}
              thumbLabel="Leverage"
              detents={LEVERAGE_DETENTS}
              formatDetent={(v) => `${v}×`}
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-2">
          <Gauge
            value={marginUse(lev)}
            size={GAUGE_PX}
            gaugeType="half"
            primary={{ 0: "var(--up)", [GAUGE_WARN_AT]: "var(--gold)", [GAUGE_DANGER_AT]: "var(--down)" }}
            secondary="var(--muted)"
            showValue
            label="MARGIN USE"
          />
          <p className="font-mono text-micro text-muted-foreground">
            LIQ <span className="text-down tabular-nums">{amount(liquidation6(market.price6, lev, side))}</span>
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 font-mono text-label">
        {summary.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="px-4">
        <ButtonHoldAndRelease
          className="h-12 w-full"
          disabled={closed || (step !== null && step < EXECUTION_STEPS.length)}
          icon={<ScanFace className="size-4" />}
          label={closed ? "MARKET NOT OPEN" : `HOLD · ${side.toUpperCase()} ${market.symbol} ${lev}x · FACE ID`}
          releaseLabel="RELEASE TO CONFIRM"
          onConfirm={() => setStep(0)}
        />
        <p className="mt-2 text-center font-mono text-micro text-muted-foreground">
          ORACLE · UPDATED {age(market.oracleAgeSec)} AGO · PREVIEW, NO ORDER IS SENT
        </p>
      </div>
      {step !== null && (
        <div className={cn("mx-4 mt-3 rounded-xs border border-primary/40 bg-card p-3")}>
          <p className="mb-2 flex items-center gap-1.5 font-mono text-label text-primary">
            <Zap className="size-3" aria-hidden />
            EXECUTION
          </p>
          <TaskSteps label="Order execution" steps={EXECUTION_STEPS} current={step} />
        </div>
      )}
    </div>
  );
}
