"use client";

import { blockerCopy } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { ScanFace } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { PreviewBadge } from "@/components/shell/preview-badge";
import { Gauge } from "@/components/ui/gauge";
import { ButtonHoldAndRelease } from "@/components/ui/hold-and-release-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { BPS_PERCENT_DECIMALS } from "@/lib/constants/money";
import { ROUTES } from "@/lib/constants/routes";
import { GAUGE_DANGER_AT, GAUGE_PX, GAUGE_WARN_AT, LEVERAGE_DETENTS, LEVERAGE_MIN } from "@/lib/constants/ticket";
import { MONEY, money, pctBps, plotValue, price18, priceDecimalsOf } from "@/lib/format";
import { type Side, useTicket } from "@/lib/trade/use-ticket";
import { cn } from "@/lib/utils";

const SIDES = [
  { value: "long", label: "LONG" },
  { value: "short", label: "SHORT" },
] as const;

const SIGN_IN = "Sign in";

/**
 * Ticket (D2 anatomy, S11b): side, margin with MAX, leverage up to the market's own maximum, the margin-use gauge and
 * the summary — every figure from the `@senryo/core` preview against the live market and, when signed in, the
 * account's latest risk. The first blocker in spec order names what stops a trade. Sending is not connected on the
 * desk yet; the hold button says so instead of pretending.
 */
export function Ticket({ market, className }: { market: LiveMarket; className?: string }) {
  const t = useTicket(market);
  const amountId = useId();
  const decimals = priceDecimalsOf(market.marketId);
  const p = t.preview;
  const usage = p && t.hasAccount ? plotValue(p.marginUsageBps, BPS_PERCENT_DECIMALS) : 0;
  const detents = LEVERAGE_DETENTS.filter((d) => d <= market.maxLeverageX);
  const blocked = t.blocker ? blockerCopy(t.blocker, market.name, t.nowSec, money) : undefined;
  const account = (value: string) => (t.hasAccount ? value : SIGN_IN);

  const summary = [
    ["POSITION", p ? money(t.notionalUsd6, 0) : "—"],
    // The initial margin the engine holds for this trade (it joins Locked) — not the amount typed above.
    ["LOCKS", p ? money(p.marginUsd6) : "—"],
    ["ENTRY ≈", p ? price18(p.execPrice18, decimals) : "—"],
    [`FEE ${pctBps(market.risk.feeBps, false)}`, p ? money(p.feeUsd6) : "—"],
    ["IMPACT", p ? pctBps(p.impactBps, false) : "—"],
    ["FREE AFTER", p ? account(money(p.freeToTradeAfter, 0)) : "—"],
  ] as const;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 border-border border-b">
        <div className="border-border border-r p-3">
          <SegmentedControl
            label="Side"
            fill
            value={t.side}
            onValueChange={(v) => t.setSide(v as Side)}
            options={SIDES}
          />
          <div className="mt-3 space-y-2 font-mono text-label">
            <div className="flex items-baseline justify-between">
              <label className="text-muted-foreground" htmlFor={amountId}>
                MARGIN ({MONEY})
              </label>
              <button
                type="button"
                onClick={t.setMax}
                disabled={!t.hasAccount || t.maxAmountUsd6 === 0n}
                className="text-primary disabled:text-muted-foreground"
              >
                MAX
              </button>
            </div>
            <input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={t.amountText}
              onChange={(e) => t.setAmountText(e.target.value)}
              aria-invalid={t.invalidAmount}
              className="block w-full rounded-xs border border-border bg-card px-2 py-1.5 text-body text-foreground tabular-nums outline-none focus-visible:border-ring aria-invalid:border-down"
            />
            <div className="flex justify-between pt-1 text-muted-foreground">
              <span>LEVERAGE</span>
              <span className="text-foreground">{t.leverage}×</span>
            </div>
            <Slider
              value={[t.leverage]}
              onValueChange={(v) => t.setLeverage(v[0] ?? LEVERAGE_MIN)}
              min={LEVERAGE_MIN}
              max={Math.max(LEVERAGE_MIN + 1, market.maxLeverageX)}
              step={1}
              thumbLabel="Leverage"
              detents={detents}
              formatDetent={(v) => `${v}×`}
              disabled={market.maxLeverageX <= LEVERAGE_MIN}
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-2">
          <Gauge
            value={usage}
            size={GAUGE_PX}
            gaugeType="half"
            primary={{ 0: "var(--up)", [GAUGE_WARN_AT]: "var(--gold)", [GAUGE_DANGER_AT]: "var(--down)" }}
            secondary="var(--muted)"
            showValue={p !== undefined && t.hasAccount}
            label="MARGIN USE"
          />
          <p className="font-mono text-micro text-muted-foreground">
            LIQ{" "}
            <span className="text-down tabular-nums">
              {p && t.hasAccount ? (p.liqPrice18 === null ? "none" : price18(p.liqPrice18, decimals)) : "—"}
            </span>
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 font-mono text-label">
        {summary.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={cn("truncate tabular-nums", v === SIGN_IN && "text-muted-foreground")}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 px-4">
        {blocked ? (
          <p role="status" className="text-caption">
            <span className="text-warn">{blocked.title}</span>
            {blocked.action && t.blocker?.code === "NO_ACCOUNT" ? (
              <>
                {" · "}
                <Link href={ROUTES.welcome} className="text-primary underline-offset-4 hover:underline">
                  {blocked.action}
                </Link>
              </>
            ) : blocked.action ? (
              <span className="text-muted-foreground"> · {blocked.action}</span>
            ) : null}
          </p>
        ) : null}
        <ButtonHoldAndRelease
          className="h-12 w-full"
          disabled
          icon={<ScanFace className="size-4" />}
          label={`${t.side.toUpperCase()} ${market.symbol} ${t.leverage}× · NOT ON WEB YET`}
        />
        <PreviewBadge
          tag="Not sent"
          missing="Sending isn't connected on the desk yet. Every figure above is the engine's live preview; trade from the Senryo app."
        />
      </div>
    </div>
  );
}
