"use client";

/**
 * The ticket (flow book C3; Fomo F37, the phone's Ticket): Short (red) / Long (green), the leveraged size above the
 * centred margin hero, presets ($10 / $50 / $100 / Max), the leverage ruler up to the market's own maximum, the
 * liquidation estimate, "Buying power $x · Pay with AUSD ⌄" (C3 step 4: any holding; Practice dollars only), Details
 * (entry, fee, impact, funding and borrow, acceptable price, and the composed steps — "Swap X → AUSD · Move to trading
 * · Open", with "Network fee" first on Mainnet when MON is short), the first blocker named before the slide, and the
 * slide in the side's colour — "· passkey" above the session's caps or with a swap leg. Once confirmed, the outcome
 * replaces the form; it never resends.
 */
import { DECIMALS, formatUnits } from "@senryo/core";
import { type LiveMarket, stepsLine } from "@senryo/query";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { DetailRow } from "@/components/kit/list-row";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { AssetPicker } from "@/components/money/asset-picker";
import { Slider } from "@/components/ui/slider";
import { useAccount } from "@/lib/account/provider";
import { useTermsAccepted } from "@/lib/account/terms";
import { USD6_ONE } from "@/lib/constants/money";
import { positionHref, ROUTES, setupHref } from "@/lib/constants/routes";
import { LEVERAGE_DETENTS, LEVERAGE_MIN, MARGIN_PRESETS } from "@/lib/constants/ticket";
import { MONEY, money, pctBps, price18, priceDecimalsOf } from "@/lib/format";
import { amountOf } from "@/lib/money/format";
import { type CommitState, commitState, type Side } from "@/lib/trade/commit";
import { borrowApr, fundingForSide, marketRates } from "@/lib/trade/rates";
import { useTicket } from "@/lib/trade/use-ticket";
import { cn } from "@/lib/utils";
import { OrderOutcome } from "./order-outcome";
import { RiskPrimer, useRiskPrimer } from "./risk-primer";

const FIX_HREF = {
  addMoney: ROUTES.addMoney,
  createAccount: ROUTES.welcome,
  maxLeverage: undefined,
  closePosition: undefined,
} as const;
const ACCEPTABLE_BPS = 50n;

function SideToggle({ side, onSide }: { side: Side; onSide: (s: Side) => void }) {
  return (
    <fieldset aria-label="Side" className="grid grid-cols-2 gap-1 rounded-md bg-raised-2 p-1">
      {(["short", "long"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={side === s}
          onClick={() => onSide(s)}
          className={cn(
            "h-11 rounded-sm text-button transition-colors",
            side === s
              ? s === "long"
                ? "bg-up text-up-foreground"
                : "bg-down text-down-foreground"
              : "text-text-2 hover:text-foreground",
          )}
        >
          {s === "long" ? "Long" : "Short"}
        </button>
      ))}
    </fieldset>
  );
}

export function Ticket({ market }: { market: LiveMarket }) {
  const t = useTicket(market);
  const amountId = useId();
  const [details, setDetails] = useState(false);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [rearm, setRearm] = useState(0);
  const primer = useRiskPrimer();
  const accepted = useTermsAccepted(useAccount().hint?.address);
  const { setSide } = t;
  // "Trade this" (C11) opens the ticket on the trader's side; the amount is never prefilled.
  useEffect(() => {
    const side = new URLSearchParams(window.location.search).get("side");
    if (side === "long" || side === "short") setSide(side);
  }, [setSide]);
  const decimals = priceDecimalsOf(market.marketId);
  const p = t.preview;
  const detents = LEVERAGE_DETENTS.filter((d) => d <= market.maxLeverageX);
  const rates = marketRates(market);

  if (t.trace.events.length > 0)
    return (
      <OrderOutcome
        events={t.trace.events}
        record={t.trace.record}
        running={t.trace.running}
        onLeave={() => undefined}
        onDone={() => {
          if (t.trace.events.some((e) => e.stage === "finalized")) t.setAmountText("");
          t.trace.reset();
        }}
      />
    );

  // Terms before the first trade (A11): an account that hasn't agreed is sent to setup's terms step and back here.
  const commit: CommitState =
    t.hasAccount && !accepted
      ? { label: "Agree to the terms first", ready: false }
      : commitState({
          side: t.side,
          amountUsd6: t.amountUsd6,
          blocker: t.blocker,
          gasStep: t.gasStep,
          hasAccount: t.hasAccount,
          clientReady: t.clientReady,
          previewReady: p !== undefined,
          confirmWith: t.confirmWith,
        });
  const termsHref = t.hasAccount && !accepted ? setupHref(ROUTES.trade(market.symbol)) : undefined;
  const fixHref =
    termsHref ??
    (commit.fix ? (commit.fix === "closePosition" ? positionHref(market.symbol) : FIX_HREF[commit.fix]) : undefined);
  // The order's identity at the slide: any change re-arms it; so does a confirmation that sent nothing.
  const resetKey = [
    t.intent,
    t.confirmWith,
    p?.execPrice18 ?? "",
    market.tickStale ? "paused" : "live",
    primer.generation,
    rearm,
  ].join("|");
  const confirm = async () => {
    if (t.gasStep.kind === "failed") t.resetGas();
    setProblem(undefined);
    const sent = await t.submit().catch(() => undefined);
    // A network fee that can't be paid is named, never a dead end (B11); the slide re-arms either way.
    if (typeof sent === "string") setProblem(sent);
    if (!sent || typeof sent === "string") setRearm((n) => n + 1);
  };
  const pay = t.pay;
  // Paying with another asset that can't cover the shortfall right now names why, ahead of "Insufficient funds".
  const payWhy = t.blocker?.code === "INSUFFICIENT_FREE" && pay.shortfallUsd6 > 0n ? pay.block : undefined;
  const planned = t.planned;
  const steps = planned?.ok
    ? stepsLine(planned.op.steps)
    : pay.labels.length > 0
      ? stepsLine([...pay.labels, "Open"].map((label) => ({ label })))
      : undefined;
  const why = problem ?? (planned && !planned.ok ? planned.block : undefined);

  if (picking)
    return (
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <p className="text-row">Pay with</p>
          {pay.note ? <p className="text-meta text-text-3">{pay.note}</p> : null}
        </div>
        <AssetPicker
          assets={pay.assets}
          other={pay.other}
          selectedKey={pay.payWith?.key}
          reasonFor={pay.reasonFor}
          detailFor={(a) => amountOf(a, a.total)}
          onPick={(a) => {
            pay.choose(a.key);
            setPicking(false);
          }}
        />
        <button type="button" onClick={() => setPicking(false)} className="text-meta text-link hover:underline">
          Back to order
        </button>
      </div>
    );

  return (
    <div className="grid gap-4">
      <SideToggle side={t.side} onSide={t.setSide} />
      <div className="grid justify-items-center gap-1 pt-2">
        <p className="text-meta text-text-2 tnum">
          {t.notionalUsd6 > 0n ? `${money(t.notionalUsd6)} exposure · ${t.leverage}×` : `${t.leverage}× leverage`}
        </p>
        <label htmlFor={amountId} className="sr-only">
          Margin in {MONEY}
        </label>
        <div className="flex items-baseline justify-center font-display text-display-margin tnum">
          <span className={t.amountText === "" ? "text-text-3" : ""}>{MONEY}</span>
          <input
            id={amountId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={t.amountText}
            onChange={(e) => t.setAmountText(e.target.value)}
            className="w-[6ch] min-w-0 bg-transparent text-center outline-none placeholder:text-text-3"
            style={{ width: `${Math.max(1, t.amountText.length) + 1}ch` }}
          />
        </div>
        <p className="text-meta text-text-3">Margin</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {MARGIN_PRESETS.map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => t.setAmountUsd6(v * USD6_ONE)}
            className="h-9 rounded-full bg-raised-2 px-4 text-meta hover:bg-row-pressed"
          >
            {MONEY}
            {String(v)}
          </button>
        ))}
        <button
          type="button"
          disabled={t.maxAmountUsd6 === 0n}
          onClick={() => t.setAmountUsd6(t.maxAmountUsd6)}
          className="h-9 rounded-full bg-raised-2 px-4 text-meta hover:bg-row-pressed disabled:opacity-40"
        >
          Max
        </button>
      </div>
      <div className="grid gap-2">
        <div className="flex justify-between text-meta">
          <span className="text-text-2">Leverage</span>
          <span className="tnum">{t.leverage}×</span>
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
      <div className="grid">
        <DetailRow
          label="Liquidation"
          value={p && t.hasAccount ? (p.liqPrice18 === null ? "None" : `$${price18(p.liqPrice18, decimals)}`) : "—"}
          tone="down"
        />
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={`Buying power ${pay.buyingPowerUsd6 !== undefined ? money(pay.buyingPowerUsd6) : "unknown"}. Pay with ${pay.payWith?.symbol ?? "AUSD"}. Change`}
          className="flex items-center justify-between gap-2 py-1.5 text-left text-meta text-text-2 hover:text-foreground"
        >
          <span>
            Buying power{" "}
            <span className="text-foreground tnum">
              {pay.buyingPowerUsd6 !== undefined ? money(pay.buyingPowerUsd6) : "—"}
            </span>
            {" · "}Pay with {pay.payWith?.symbol ?? "AUSD"}
            {pay.note ? <span className="block text-text-3">{pay.note}</span> : null}
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
          className="flex items-center justify-between py-1.5 text-meta text-text-2 hover:text-foreground"
        >
          Details <ChevronDown className={cn("size-4 transition-transform", details && "rotate-180")} aria-hidden />
        </button>
        {details ? (
          <div>
            <DetailRow label="Entry ≈" value={p ? `$${price18(p.execPrice18, decimals)}` : "—"} />
            <DetailRow label={`Fee ${pctBps(market.risk.feeBps, false)}`} value={p ? money(p.feeUsd6) : "—"} />
            <DetailRow label="Spread + impact" value={p ? pctBps(p.impactBps, false) : "—"} />
            <DetailRow label="Funding" value={fundingForSide(rates, t.side === "long")} />
            <DetailRow label="Borrow" value={borrowApr(rates)} />
            <DetailRow label="Locks" value={p ? money(p.marginUsd6) : "—"} />
            <DetailRow
              label="Acceptable price"
              value={`±${formatUnits(ACCEPTABLE_BPS, DECIMALS.bpsAsPct, DECIMALS.cents)}%`}
            />
            {steps ? <DetailRow label="Steps" value={steps} /> : null}
          </div>
        ) : null}
      </div>
      {why || payWhy ? (
        <p role="status" className="text-center text-meta text-warn">
          {why ?? payWhy}
        </p>
      ) : t.blocker || commit.fix || termsHref ? (
        <p role="status" className="text-center text-meta text-warn">
          {commit.label}
          {fixHref ? (
            <>
              {" · "}
              <Link href={fixHref} className="text-link hover:underline">
                {termsHref
                  ? "Terms"
                  : commit.fix === "addMoney"
                    ? "Add money"
                    : commit.fix === "createAccount"
                      ? "Create account"
                      : "Open it"}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <SlideToConfirm
        label={commit.label}
        tone={t.side === "long" ? "up" : "down"}
        disabled={!commit.ready || (planned !== undefined && !planned.ok)}
        busy={commit.busy ?? false}
        resetKey={resetKey}
        onConfirm={() => (primer.needed(t.side) ? primer.open(t.side) : void confirm())}
      />
      <RiskPrimer state={primer} />
    </div>
  );
}
