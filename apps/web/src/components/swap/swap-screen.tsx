"use client";

/**
 * Swap any ↔ any (flow book B6; plan §0.9 Swap, Phantom grammar; 21st ssychui/swap-ticket #27122 for the flip of the
 * two plates): "You pay" (any holding, amount, balance, Max) / flip / "You receive" (any verified token, the estimate);
 * one line with rate · impact (amber over 1 %, blocked over 5 % with the size that fits); Details — route, minimum
 * received, network fee; Review → one slide and the passkey → the outcome. Practice shows the API's own reason: no
 * aggregator serves the test network, so swaps are Mainnet only there.
 */
import { ArrowDownUp, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DetailRow, QuietLine } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { PageHeader } from "@/components/kit/page-header";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { SEND_WORDS } from "@/components/kit/trace-words";
import { AssetMark } from "@/components/money/asset-mark";
import { AssetPicker } from "@/components/money/asset-picker";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { cleanAmountText } from "@/lib/money/amount";
import type { MoneyAsset } from "@/lib/money/assets";
import { amountOf } from "@/lib/money/format";
import { hopsText, impactText, maxUnderBlock, monFee, rateText, swapProviderName } from "@/lib/swap/format";
import { type SwapBlock, type SwapState, useSwap } from "@/lib/swap/use-swap";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { cn } from "@/lib/utils";

const MARK_CHIP = 28;
const SWAP_WORDS = { ...SEND_WORDS, thing: "swap", again: "swap it again", pending: "Swapping", success: "Swapped" };

const BLOCK_WORDS: Record<Exclude<SwapBlock, "impact" | "unsupported">, string> = {
  account: "Create an account to swap",
  empty: "Enter an amount",
  short: "More than available",
  quoting: "Getting the best price…",
  "no-route": "No route for this pair",
  failed: "Quote unavailable · try again",
  "unverified-receive": "Unverified tokens can’t be bought",
};

function Chip({ asset, onClick }: { asset: MoneyAsset | undefined; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full bg-background/60 py-1.5 pr-3 pl-1.5 text-row hover:bg-row-pressed"
    >
      {asset ? <AssetMark asset={asset} size={MARK_CHIP} /> : null}
      {asset?.symbol ?? "Choose"}
      <ChevronDown className="size-4 text-text-2" aria-hidden />
    </button>
  );
}

function Review({ s }: { s: SwapState }) {
  const outcome = useSettledOutcome(s.runner.trace.events);
  const r = s.reviewed;
  if (!r) return null;
  if (s.runner.trace.events.length > 0)
    return (
      <OperationStatus
        events={s.runner.trace.events}
        record={s.runner.trace.record}
        running={s.runner.trace.running}
        outcome={outcome}
        words={{ ...SWAP_WORDS, success: `Swapped for ${r.receive.symbol}` }}
        facts={
          <>
            <DetailRow label="Paid" value={amountOf(r.pay, r.amount)} />
            <DetailRow label="At least" value={amountOf(r.receive, r.quote.quote.minOut)} />
          </>
        }
        onDone={() => {
          s.runner.reset();
          s.closeReview();
        }}
        onLeave={() => s.closeReview()}
      />
    );
  return (
    <section className="grid gap-4" aria-label="Review swap">
      <div>
        <DetailRow label="You pay" value={amountOf(r.pay, r.amount)} />
        <DetailRow label="You receive ≈" value={amountOf(r.receive, r.quote.quote.amountOut)} />
        <DetailRow label="At least" value={amountOf(r.receive, r.quote.quote.minOut)} />
        <DetailRow label="Route" value={`${swapProviderName(r.quote.quote.provider)} · ${hopsText(r.quote)}`} />
        <DetailRow label="Steps" value={r.steps.map((x) => x.label).join(" → ")} />
        <DetailRow label="Confirm with" value="Passkey" />
      </div>
      {s.problem ? <p className="text-center text-meta text-down">{s.problem}</p> : null}
      <SlideToConfirm
        label="Slide to swap"
        resetKey={`${r.pay.key}|${r.amount}|${r.quote.quote.minOut}`}
        onConfirm={() => void s.confirm()}
      />
      <Button variant="ghost" className="font-sans" onClick={s.closeReview}>
        Back
      </Button>
    </section>
  );
}

function Ticket({ s }: { s: SwapState }) {
  const [picking, setPicking] = useState<"pay" | "receive">();
  if (picking)
    return (
      <AssetPicker
        assets={picking === "pay" ? s.payable.filter((a) => a.verified) : s.receivable}
        other={picking === "pay" ? s.payable.filter((a) => !a.verified) : []}
        selectedKey={picking === "pay" ? s.pay.key : s.receive?.key}
        reasonFor={() => undefined}
        detailFor={(a) => (picking === "pay" ? `Balance ${amountOf(a, a.total)}` : a.symbol)}
        onPick={(a) => {
          if (picking === "pay") s.setPay(a.key);
          else s.setReceive(a.key);
          setPicking(undefined);
        }}
      />
    );
  const ok = s.ok;
  const impact = ok?.quote.impact;
  const limit = ok && impact === "block" ? maxUnderBlock(ok) : undefined;
  const unsupported = s.value?.status === "unsupported" ? s.value.reason : undefined;
  const label =
    s.block === "impact"
      ? limit !== undefined
        ? `Price impact over 5% · max ≈ ${amountOf(s.pay, limit)}`
        : "Price impact over 5%"
      : s.block && s.block !== "unsupported"
        ? BLOCK_WORDS[s.block]
        : undefined;
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 rounded-md bg-raised-2 p-4">
        <p className="text-meta text-text-2">You pay</p>
        <div className="flex items-center gap-3">
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label={`Amount of ${s.pay.symbol}`}
            value={s.text}
            onChange={(e) => {
              const next = cleanAmountText(e.target.value, s.pay.decimals);
              if (next !== undefined) s.setText(next);
            }}
            className="min-w-0 flex-1 bg-transparent font-display text-display-price outline-none tnum placeholder:text-text-3"
          />
          <Chip asset={s.pay} onClick={() => setPicking("pay")} />
        </div>
        <p className="text-meta text-text-3">
          Available {amountOf(s.pay, s.available)}
          <button type="button" onClick={s.fillMax} className="ml-2 text-link hover:underline">
            Max
          </button>
        </p>
      </div>
      <button
        type="button"
        aria-label="Flip"
        onClick={s.flip}
        className="mx-auto -my-4 z-10 grid size-10 place-items-center rounded-full border-4 border-background bg-raised-2 hover:bg-row-pressed"
      >
        <ArrowDownUp className="size-4" />
      </button>
      <div className="grid gap-2 rounded-md bg-raised-2 p-4">
        <p className="text-meta text-text-2">You receive</p>
        <div className="flex items-center gap-3">
          <p className={cn("min-w-0 flex-1 truncate font-display text-display-price tnum", !ok && "text-text-3")}>
            {ok && s.receive ? amountOf(s.receive, ok.quote.amountOut).replace(` ${s.receive.symbol}`, "") : "0"}
          </p>
          <Chip asset={s.receive} onClick={() => setPicking("receive")} />
        </div>
      </div>
      {unsupported ? (
        <p className="flex items-center justify-center gap-2 py-2 text-center text-meta text-text-2">
          <Lock className="size-4" aria-hidden /> Mainnet only · {unsupported}
        </p>
      ) : null}
      {ok ? (
        <div className="pt-1">
          <p
            className={cn(
              "text-center text-meta",
              impact === "warn" ? "text-warn" : impact === "block" ? "text-down" : "text-text-2",
            )}
          >
            {rateText(ok)} · {impactText(ok)}
          </p>
          <DetailRow label="Route" value={`${swapProviderName(ok.quote.provider)} · ${hopsText(ok)}`} />
          {s.receive ? <DetailRow label="At least" value={amountOf(s.receive, ok.quote.minOut)} /> : null}
          <DetailRow label="Network fee" value={`~${monFee(s.feeWei)}`} />
        </div>
      ) : null}
      {s.problem ? <p className="text-center text-meta text-down">{s.problem}</p> : null}
      <Button size="xl" disabled={s.block !== undefined || s.preparing} onClick={() => void s.review()}>
        {s.preparing ? "Preparing…" : (label ?? (unsupported ? "Swaps are Mainnet only" : "Review"))}
      </Button>
    </div>
  );
}

export function SwapScreen() {
  const s = useSwap(useSearchParams().get("pay") ?? undefined);
  return (
    <Column className="grid gap-4">
      <PageHeader title="Swap" back={ROUTES.home} />
      {!s.address ? (
        <QuietLine action={{ label: "Create account", href: ROUTES.welcome }}>An account swaps</QuietLine>
      ) : s.reviewed ? (
        <Review s={s} />
      ) : (
        <Ticket s={s} />
      )}
      <Link href={ROUTES.addMoney} className="text-center text-meta text-link hover:underline">
        Add money ›
      </Link>
    </Column>
  );
}
