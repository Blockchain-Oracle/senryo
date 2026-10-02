"use client";

/**
 * A position (flow book C5, plan §0.9 Position; the phone's PositionDetail): the P&L hero net of funding and borrow,
 * coloured by profit; the stat strip Size (oz / units) · Entry · Mark · Liq.; funding and borrow owed; TP / SL; then
 * Reduce 25 / 50 / 75 / 100 % with its quote and the slide to close in the side's colour. A full close cancels the
 * market's leftover TP/SL in the same operation. The outcome reads the reviewed quote and never resends.
 */
import { engineMarket } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useQueryEnv } from "@senryo/query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SideBadge } from "@/components/home/position-row";
import { EntityMark } from "@/components/identity/entity-mark";
import { AmountHero } from "@/components/kit/amount-hero";
import { DetailRow, QuietLine } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { PageHeader } from "@/components/kit/page-header";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { CLOSE_WORDS } from "@/components/kit/trace-words";
import { Column } from "@/components/shell/column";
import { Skeleton } from "@/components/ui/skeleton";
import { MARK_ROW } from "@/lib/constants/brand";
import { DEFAULT_MARKET, ROUTES } from "@/lib/constants/routes";
import { REDUCE_ALL_BPS, REDUCE_STEPS_BPS } from "@/lib/constants/ticket";
import { money, price18, priceDecimalsOf, signedMoney, wholePct } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/markets/session";
import { netPnl, quantityText } from "@/lib/trade/quantity";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { usePosition } from "@/lib/trade/use-position";
import { cn } from "@/lib/utils";
import { liquidationLabel } from "../home/position-row";
import { TpSl } from "./tp-sl";

const shareLabel = (bps: bigint) => (bps >= REDUCE_ALL_BPS ? "100%" : wholePct(bps));

function CloseOutcome({ p }: { p: ReturnType<typeof usePosition> }) {
  const outcome = useSettledOutcome(p.trace.events);
  const q = p.quoted;
  const symbol = p.market?.symbol ?? "";
  return (
    <OperationStatus
      events={p.trace.events}
      record={p.trace.record}
      running={p.trace.running}
      outcome={outcome}
      words={{
        ...CLOSE_WORDS,
        pending: q?.closingAll ? `Closing ${symbol}` : `Reducing ${symbol}`,
        success: q?.closingAll ? `${symbol} closed` : `${symbol} reduced ${q ? shareLabel(q.shareBps) : ""}`,
      }}
      facts={
        q ? (
          <>
            <DetailRow
              label="Exit (quoted)"
              value={`$${price18(q.execPrice18, priceDecimalsOf(p.market?.marketId ?? 0))}`}
            />
            <DetailRow
              label="Realised (quoted)"
              value={signedMoney(q.realizedPnlUsd6)}
              tone={q.realizedPnlUsd6 < 0n ? "down" : "up"}
            />
            <DetailRow label="To balance (quoted)" value={signedMoney(q.netUsd6)} />
          </>
        ) : null
      }
      onLeave={() => undefined}
      onDone={() => p.trace.reset()}
    />
  );
}

function Detail({ marketId }: { marketId: number }) {
  const env = useQueryEnv();
  const p = usePosition(marketId);
  const m = p.market;
  const symbol = engineMarket(marketId)?.symbol ?? DEFAULT_MARKET;
  if (p.trace.events.length > 0) return <CloseOutcome p={p} />;
  if (p.loading)
    return (
      <div className="grid gap-3 pt-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (!p.position || !m)
    return <QuietLine action={{ label: `Trade ${symbol}`, href: ROUTES.trade(symbol) }}>No open position</QuietLine>;
  const position = p.position;
  const decimals = priceDecimalsOf(marketId);
  const health = p.health;
  const net = health ? netPnl(health.upnlUsd6, p.fundingUsd6, p.borrowUsd6) : undefined;
  const r = p.reduce;
  const waitMs =
    r?.holdReadyBlock !== undefined && p.headBlock !== undefined ? r.holdReadyBlock - p.headBlock : undefined;
  const resetKey = [env.chainId, marketId, p.shareBps, position.size, r?.execPrice18 ?? ""].join("|");
  const label = p.closingAll ? "Slide to close" : `Slide to reduce ${shareLabel(p.shareBps)}`;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3 pt-2">
        <EntityMark id={ids.engineMarket(env.chainId, marketId)} size={MARK_ROW} decorative />
        <p className="text-row">
          {m.symbol}
          <SideBadge isLong={position.isLong} />
        </p>
      </div>
      <div>
        <p className="text-meta text-text-3">Unrealised P&L</p>
        {net === undefined ? (
          <Skeleton className="mt-2 h-12 w-48" />
        ) : (
          <AmountHero text={signedMoney(net)} tone={net < 0n ? "down" : "up"} />
        )}
        <p className="text-meta text-text-2">{health ? liquidationLabel(health.liqDistanceBps) : null}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-raised-2 p-4 sm:grid-cols-4">
        {[
          ["Size", quantityText(marketId, position.size)],
          ["Entry", `$${price18(position.entry, decimals)}`],
          ["Mark", `$${price18(m.pv.price18, decimals)}`],
          ["Liq.", health?.liqPrice18 ? `$${price18(health.liqPrice18, decimals)}` : "None"],
        ].map(([k, v]) => (
          <div key={k}>
            <dd className="text-row tnum">{v}</dd>
            <dt className="text-meta text-text-3">{k}</dt>
          </div>
        ))}
      </dl>
      <div>
        <DetailRow label="Exposure" value={money(p.currentNotionalUsd6)} />
        <DetailRow label="Funding owed" value={signedMoney(-p.fundingUsd6)} />
        <DetailRow label="Borrow owed" value={signedMoney(-p.borrowUsd6)} />
      </div>
      <TpSl market={m} position={position} liq18={health?.liqPrice18} />
      <section aria-labelledby="reduce" className="grid gap-3">
        <h2 id="reduce" className="text-section-title">
          Reduce
        </h2>
        <div className="flex gap-2">
          {REDUCE_STEPS_BPS.map((bps) => (
            <button
              key={String(bps)}
              type="button"
              aria-pressed={p.shareBps === bps}
              onClick={() => p.setShareBps(bps)}
              className={cn(
                "h-9 flex-1 rounded-full text-meta",
                p.shareBps === bps ? "bg-foreground text-background" : "bg-raised-2 hover:bg-row-pressed",
              )}
            >
              {shareLabel(bps)}
            </button>
          ))}
        </div>
        {r ? (
          <div>
            <DetailRow label="Exit price" value={`$${price18(r.execPrice18, decimals)}`} />
            <DetailRow
              label={r.profitCapped ? "Realised · capped" : "Realised"}
              value={signedMoney(r.realizedPnlUsd6)}
              tone={r.realizedPnlUsd6 < 0n ? "down" : "up"}
            />
            <DetailRow label="Fee" value={money(r.feeUsd6)} />
            <DetailRow label="To balance" value={signedMoney(r.netUsd6)} />
          </div>
        ) : null}
        {m.pv.status !== "OPEN" ? (
          <p className="text-meta text-warn">
            Market {STATUS_LABEL[m.pv.status].toLowerCase()} · closing works at the closed spread
          </p>
        ) : null}
        {waitMs !== undefined && waitMs > 0n ? (
          <p className="text-meta text-text-3">Profit close in a few blocks</p>
        ) : null}
        {p.closingAll && p.leftovers.length > 0 ? (
          <p className="text-meta text-text-3">Closing also cancels {p.leftovers.length} TP/SL</p>
        ) : null}
        <SlideToConfirm
          label={label}
          tone={position.isLong ? "up" : "down"}
          disabled={!p.ready || !r || (waitMs !== undefined && waitMs > 0n)}
          resetKey={resetKey}
          onConfirm={() => void p.submit()}
        />
      </section>
      <Link href={ROUTES.trade(m.symbol)} className="text-center text-meta text-link hover:underline">
        Add to this position ›
      </Link>
    </div>
  );
}

export function PositionScreen() {
  const symbol = (useSearchParams().get("market") ?? DEFAULT_MARKET).toUpperCase();
  const meta = engineMarket(symbol);
  return (
    <Column>
      <PageHeader title={meta ? `${meta.symbol} position` : "Position"} back={ROUTES.home} />
      {meta ? <Detail marketId={meta.id} /> : <QuietLine>Unknown market</QuietLine>}
    </Column>
  );
}
