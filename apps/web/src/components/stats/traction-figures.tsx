"use client";

/**
 * The traction figures for one network (D-022): traded notional as the one hero, then accounts created, accounts that
 * traded, trades, pool value and card holds as rows. Every figure is the indexer's counter or the pool contract's own
 * value; one the indexer can't answer on this network shows "—" with its reason, never a zero it didn't count.
 */
import type { NetworkConfig } from "@senryo/config";
import { ArrowLeftRight, CreditCard, Landmark, type LucideIcon, UserRoundCheck, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { AmountHero } from "@/components/kit/amount-hero";
import { ListRow } from "@/components/kit/list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyOn } from "@/lib/format";
import { useDeployment, usePoolValue, useTraction } from "@/lib/stats/traction";
import { formatCount } from "./format";

const PERCENT = 100;

type Figure =
  | { kind: "loading" }
  | { kind: "value"; text: string; detail?: string | undefined }
  | { kind: "none"; reason: string }
  | { kind: "failed"; reason: string; retry: () => void };

const LOADING: Figure = { kind: "loading" };

function Glyph({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-10 place-items-center rounded-full bg-raised-2 text-text-2">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function FigureRow({
  icon,
  title,
  subtitle,
  figure,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  figure: Figure;
}) {
  let value: ReactNode = "—";
  if (figure.kind === "value") value = figure.text;
  if (figure.kind === "loading")
    value = <span aria-hidden className="inline-block h-5 w-16 animate-pulse rounded-xs bg-muted" />;
  const reason = figure.kind === "none" || figure.kind === "failed" ? figure.reason : undefined;
  return (
    <ListRow
      leading={<Glyph icon={icon} />}
      title={title}
      subtitle={reason ?? subtitle}
      value={value}
      detail={figure.kind === "value" ? figure.detail : undefined}
      onClick={figure.kind === "failed" ? figure.retry : undefined}
    />
  );
}

export function TractionFigures({ network }: { network: NetworkConfig }) {
  const { chainId, modeLabel } = network;
  const traction = useTraction(chainId);
  const deployment = useDeployment(chainId);
  const pool = usePoolValue(chainId, deployment.data?.pool === true);
  const totals = traction.data?.totals;
  const notLive = `Counted once Senryo’s ${modeLabel} contracts are live`;

  /** A counter the indexer keeps: answered only where Senryo's core is deployed and indexed. */
  const counted = (read: (t: NonNullable<typeof totals>) => Figure): Figure => {
    if (deployment.isPending || traction.isPending) return LOADING;
    if (deployment.data?.core === false) return { kind: "none", reason: notLive };
    if (traction.isError || deployment.isError)
      return {
        kind: "failed",
        reason: "Couldn’t reach the indexer · Retry",
        retry: () => {
          void traction.refetch();
          void deployment.refetch();
        },
      };
    if (!totals) return { kind: "none", reason: "Nothing indexed on this network yet" };
    return read(totals);
  };

  const notional = counted((t) => ({ kind: "value", text: moneyOn(chainId, t.volumeOurs + t.volumePerplApp) }));
  const accounts = counted((t) => ({ kind: "value", text: formatCount(t.users) }));
  const traders = counted((t) => ({
    kind: "value",
    text: formatCount(t.traders),
    detail: t.users > 0 ? `${Math.round((t.traders * PERCENT) / t.users)}% of accounts` : undefined,
  }));
  const trades = counted((t) => ({ kind: "value", text: formatCount(t.trades) }));
  const holds = counted((t) => ({ kind: "value", text: formatCount(t.cardHoldsPlaced) }));

  let poolValue: Figure = LOADING;
  if (deployment.data?.pool === false) poolValue = { kind: "none", reason: `No pool on ${modeLabel} yet` };
  else if (deployment.isError || pool.isError)
    poolValue = {
      kind: "failed",
      reason: "Couldn’t read the pool · Retry",
      retry: () => void (deployment.isError ? deployment.refetch() : pool.refetch()),
    };
  else if (pool.data !== undefined) poolValue = { kind: "value", text: moneyOn(chainId, pool.data) };

  return (
    <>
      <section className="grid gap-1" aria-label="Traded notional">
        <p className="text-meta text-text-3">Traded notional</p>
        {notional.kind === "loading" ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <AmountHero text={notional.kind === "value" ? notional.text : "—"} />
        )}
        <p className="text-meta text-text-3">
          {notional.kind === "none" || notional.kind === "failed" ? notional.reason : "Every fill, both venues"}
        </p>
      </section>
      <section aria-label="Accounts and activity">
        <FigureRow
          icon={UsersRound}
          title="Accounts created"
          subtitle="Addresses with a Senryo action on chain"
          figure={accounts}
        />
        <FigureRow icon={UserRoundCheck} title="Accounts that traded" subtitle="At least one fill" figure={traders} />
        <FigureRow
          icon={ArrowLeftRight}
          title="Trades"
          subtitle="Fills on Senryo’s markets and Perpl"
          figure={trades}
        />
        <FigureRow icon={Landmark} title="Pool value" subtitle="The pool contract, read now" figure={poolValue} />
        <FigureRow icon={CreditCard} title="Card holds" subtitle="Card payments held on chain" figure={holds} />
      </section>
    </>
  );
}
