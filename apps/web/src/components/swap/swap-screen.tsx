"use client";

/**
 * Swap any ↔ any (flow book B6; plan §0.9 Swap, Phantom grammar; 21st ssychui/swap-ticket #27122 for the flip of the
 * two plates; the phone's SwapView): "You pay" (any holding, amount, balance, Max) / flip / "You receive" (any verified
 * token, the estimate); one line with rate · impact (amber over 1 %, blocked over 5 % with the size that fits) that
 * opens Details — route, minimum received, network fee, steps; Review → one slide and the passkey → the outcome, which
 * a reload reopens (never a second swap beside an unresolved one). Practice: test AUSD ↔ test USDC runs the whole way
 * at par (D-252, "Practice swap · at par", fee sponsored); every other Practice pair keeps the locked slide ("Swaps run
 * on Mainnet").
 */
import { PRACTICE_SWAP_ROUTE } from "@senryo/chain";
import { ids } from "@senryo/identity";
import { parRateText, stepsLine } from "@senryo/query";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { DetailRow, QuietLine } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { PageHeader } from "@/components/kit/page-header";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { SEND_WORDS } from "@/components/kit/trace-words";
import { AssetMark } from "@/components/money/asset-mark";
import { AssetPicker } from "@/components/money/asset-picker";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { MARK_HERO, MODE_MARK_SIZE } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { cleanAmountText, plainAmount } from "@/lib/money/amount";
import type { MoneyAsset } from "@/lib/money/assets";
import { amountOf, exactAmount } from "@/lib/money/format";
import { hopsText, impactText, maxUnderBlock, monFee, rateText, swapProviderName } from "@/lib/swap/format";
import { type SwapState, useSwap } from "@/lib/swap/use-swap";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { cn } from "@/lib/utils";

const MARK_CHIP = 28;
const SWAP_WORDS = {
  ...SEND_WORDS,
  thing: "swap",
  again: "swap it again",
  landed: "Confirmed — the tokens are in your wallet.",
  pending: "Swapping",
  success: "Swapped",
};

/** What stops the swap, in the phone's words (SwapView `actionLabel`). */
function actionLabel(s: SwapState): string {
  switch (s.block) {
    case "account":
      return "Create an account";
    case "empty":
      return "Enter an amount";
    case "short":
      return `Not enough ${s.pay.symbol}`;
    case "unsupported":
      return "Swaps run on Mainnet";
    case "unverified-receive":
      return "Can’t receive unverified tokens";
    case "quoting":
      return "Getting a quote";
    case "failed":
      return "Quote unavailable · retry";
    case "no-route":
      return "No route for this pair";
    case "impact":
      return "Too big · try a smaller amount";
    default:
      return "Review";
  }
}

const SenryoMark = () => <EntityMark id={ids.brand("senryo")} label="Senryo" size={MODE_MARK_SIZE} decorative />;

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

/** One quiet line that opens Details underneath (route, minimum, fee, steps). */
function DetailsLine({ text, tone, children }: { text: string; tone: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("flex w-full items-center justify-between py-1.5 text-meta", tone)}
      >
        {text}
        <ChevronDown className={cn("size-4 text-text-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? <div className="animate-in fade-in duration-200">{children}</div> : null}
    </div>
  );
}

/** The rate line and Details: the par pair says what it is (D-252); a quote shows its route, minimum and fee. */
function QuoteLine({ s }: { s: SwapState }) {
  const q = s.ok;
  const receive = s.receive;
  const steps = [
    ...(s.pay.collateral && s.typed > s.pay.wallet ? ["Pull from trades"] : []),
    ...(s.pay.native ? [] : [`Approve ${s.pay.symbol}`]),
    "Swap",
  ].join(" · ");
  if (s.par && receive && s.typed > 0n)
    return (
      <DetailsLine text={`${parRateText(s.pay, receive)} · at par`} tone="text-text-2">
        <DetailRow
          label="Route"
          value={
            <span className="inline-flex items-center gap-1.5">
              <SenryoMark /> {PRACTICE_SWAP_ROUTE}
            </span>
          }
        />
        <DetailRow label="You receive" value={amountOf(receive, s.typed)} />
        <DetailRow label="Network fee" value="Sponsored" />
        <DetailRow label="Steps" value={steps} />
      </DetailsLine>
    );
  if (!q || !receive) return null;
  const impact = q.quote.impact;
  const tone = impact === "ok" ? "text-text-2" : impact === "warn" ? "text-warn" : "text-down";
  return (
    <DetailsLine text={`${rateText(q)} · ${impact !== "ok" ? `High ${impactText(q)}` : impactText(q)}`} tone={tone}>
      <DetailRow
        label="Route"
        value={
          <span className="inline-flex items-center gap-1.5">
            <EntityMark id={ids.provider(q.quote.provider)} size={MODE_MARK_SIZE} decorative />
            {swapProviderName(q.quote.provider)} · {hopsText(q)}
          </span>
        }
      />
      <DetailRow label="Minimum received" value={amountOf(receive, q.quote.minOut)} />
      <DetailRow label="Network fee" value={`≈ ${monFee(s.feeWei)}`} />
      <DetailRow label="Steps" value={steps} />
    </DetailsLine>
  );
}

function Review({ s }: { s: SwapState }) {
  const [busy, setBusy] = useState(false);
  const r = s.reviewed;
  if (!r) return null;
  const q = r.quote;
  const resetKey = [r.pay.key, r.receive.key, r.amount, q?.quote.minOut ?? "par", q?.quote.router ?? ""].join(":");
  return (
    <section className="grid gap-4" aria-label="Review swap">
      <div className="flex items-center justify-center gap-3 pt-2">
        <AssetMark asset={r.pay} size={MARK_HERO} />
        <ArrowDownUp className="size-4 -rotate-90 text-text-3" aria-hidden />
        <AssetMark asset={r.receive} size={MARK_HERO} />
      </div>
      <div>
        <DetailRow label="You pay" value={exactAmount(r.pay, r.amount)} />
        {q ? (
          <>
            <DetailRow label="You receive at least" value={amountOf(r.receive, q.quote.minOut)} />
            <DetailRow label="Estimate" value={amountOf(r.receive, q.quote.amountOut)} />
            <DetailRow label="Rate" value={rateText(q)} />
            <DetailRow
              label="Price impact"
              value={impactText(q)}
              {...(q.quote.impact === "ok" ? {} : { tone: "warn" as const })}
            />
            <DetailRow label="Route" value={`${swapProviderName(q.quote.provider)} · ${hopsText(q)}`} />
            <DetailRow label="Network fee" value={`≈ ${monFee(r.feeWei)}`} />
          </>
        ) : (
          <>
            <DetailRow label="You receive" value={exactAmount(r.receive, r.amount)} />
            <DetailRow label="Rate" value={parRateText(r.pay, r.receive)} />
            <DetailRow
              label="Route"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <SenryoMark /> {PRACTICE_SWAP_ROUTE}
                </span>
              }
            />
            <DetailRow label="Network fee" value="Sponsored" />
          </>
        )}
        <DetailRow label="Steps" value={stepsLine(r.steps)} />
        <DetailRow label="Confirm with" value="Passkey" />
      </div>
      {!r.pay.verified ? <p className="text-center text-meta text-warn">Unverified token · sell only</p> : null}
      {s.problem ? <p className="text-center text-meta text-down">{s.problem}</p> : null}
      <SlideToConfirm
        label={`Slide to swap ${r.pay.symbol}`}
        busy={busy}
        resetKey={resetKey}
        onConfirm={() => {
          setBusy(true);
          void s.confirm().finally(() => setBusy(false));
        }}
      />
      <Button variant="ghost" className="font-sans" onClick={s.closeReview}>
        Back
      </Button>
    </section>
  );
}

/** The outcome of the signed swap — also what a reload reopens from the journal; its facts are the reviewed intent. */
function Outcome({ s }: { s: SwapState }) {
  const trace = s.runner.trace;
  const outcome = useSettledOutcome(trace.events);
  const intent = trace.record?.reviewedIntent;
  return (
    <OperationStatus
      events={trace.events}
      record={trace.record}
      running={trace.running}
      outcome={outcome}
      words={{ ...SWAP_WORDS, ...(intent?.outSymbol ? { success: `Swapped for ${intent.outSymbol}` } : {}) }}
      facts={
        intent ? (
          <>
            {intent.paid ? <DetailRow label="Paid" value={intent.paid} /> : null}
            {intent.atLeast ? (
              <DetailRow
                label={intent.route === PRACTICE_SWAP_ROUTE ? "Received" : "Received at least"}
                value={intent.atLeast}
              />
            ) : null}
            {intent.route ? <DetailRow label="Route" value={intent.route} /> : null}
          </>
        ) : undefined
      }
      onDone={() => {
        const done = trace.record?.outcome === "completed";
        s.runner.reset();
        if (done) s.clear();
        else s.closeReview();
      }}
      onLeave={() => s.closeReview()}
    />
  );
}

function Ticket({ s }: { s: SwapState }) {
  const [picking, setPicking] = useState<"pay" | "receive">();
  if (picking)
    return (
      <AssetPicker
        assets={
          picking === "pay" ? s.payable.filter((a) => a.verified) : s.receivable.filter((a) => a.key !== s.pay.key)
        }
        other={picking === "pay" ? s.payable.filter((a) => !a.verified) : []}
        selectedKey={picking === "pay" ? s.pay.key : s.receive?.key}
        reasonFor={() => undefined}
        detailFor={(a) =>
          picking === "pay"
            ? `Balance ${amountOf(a, a.total)}`
            : a.total > 0n
              ? `You hold ${amountOf(a, a.total)}`
              : a.symbol
        }
        onPick={(a) => {
          if (picking === "pay") s.setPay(a.key);
          else s.setReceive(a.key);
          setPicking(undefined);
        }}
      />
    );
  const limit = s.block === "impact" && s.ok ? maxUnderBlock(s.ok) : undefined;
  // The par pair's estimate is the amount itself (D-252).
  const out = s.ok ? s.ok.quote.amountOut : s.par && s.typed > 0n ? s.typed : undefined;
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
        aria-label="Flip pair"
        onClick={s.flip}
        disabled={!s.receive}
        className="mx-auto -my-4 z-10 grid size-10 place-items-center rounded-full border-4 border-background bg-raised-2 hover:bg-row-pressed"
      >
        <ArrowDownUp className="size-4" />
      </button>
      <div className="grid gap-2 rounded-md bg-raised-2 p-4">
        <p className="text-meta text-text-2">You receive</p>
        <div className="flex items-center gap-3">
          <p className={cn("min-w-0 flex-1 truncate font-display text-display-price tnum", !out && "text-text-3")}>
            {out !== undefined && s.receive ? amountOf(s.receive, out).replace(` ${s.receive.symbol}`, "") : "0"}
          </p>
          <Chip asset={s.receive} onClick={() => setPicking("receive")} />
        </div>
        <p className="text-meta text-text-3">
          {s.receive && s.receive.total > 0n ? `You hold ${amountOf(s.receive, s.receive.total)}` : " "}
        </p>
      </div>
      <QuoteLine s={s} />
      {!s.pay.verified ? <p className="text-center text-meta text-warn">Unverified token · sell only</p> : null}
      {limit !== undefined && limit > 0n ? (
        <button
          type="button"
          onClick={() => s.setText(plainAmount(limit, s.pay.decimals))}
          className="text-meta text-link hover:underline"
        >
          Try {amountOf(s.pay, limit)} ›
        </button>
      ) : null}
      {s.problem ? <p className="text-center text-meta text-down">{s.problem}</p> : null}
      {s.block === "unsupported" ? (
        <SlideToConfirm label="Swaps run on Mainnet" disabled resetKey="locked" onConfirm={() => undefined} />
      ) : (
        <Button size="xl" disabled={s.block !== undefined || s.preparing} onClick={() => void s.review()}>
          {s.preparing ? "Preparing…" : actionLabel(s)}
        </Button>
      )}
    </div>
  );
}

export function SwapScreen() {
  const params = useSearchParams();
  const s = useSwap(params.get("pay") ?? undefined, params.get("receive") ?? undefined);
  const trace = s.runner.trace;
  return (
    <Column className="grid gap-4">
      <PageHeader title="Swap" back={ROUTES.home} />
      {!s.address ? (
        <QuietLine action={{ label: "Create account", href: ROUTES.welcome }}>An account swaps</QuietLine>
      ) : trace.running || trace.events.length > 0 ? (
        <Outcome s={s} />
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
