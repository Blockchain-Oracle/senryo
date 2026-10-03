"use client";

/**
 * The pool (flow book D1/D2; plan §0.9 Pool; the phone's LpScreen): the pool's mark and your investment as the one hero,
 * the APR chip with its real window (ⓘ: its source), a stat strip (Pool value · In use · Cap left), Deposit / Redeem,
 * pending redemptions as rows that count down ("Claim in 14h 02m", "Ready · Claim", "Claim opens Mon 23:05 UTC"), and
 * the disclosures as compact ⓘ rows. After a slide the page is the outcome surface; the panel that sent it stays
 * mounted underneath so its review guard holds.
 */
import type { LpRedeemView } from "@senryo/chain";
import { durationUntil, utcSlotLabel } from "@senryo/core";
import { ids } from "@senryo/identity";
import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { AmountHero } from "@/components/kit/amount-hero";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { PageHeader } from "@/components/kit/page-header";
import { ORDER_WORDS } from "@/components/kit/trace-words";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useTermsAccepted } from "@/lib/account/terms";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW } from "@/lib/constants/brand";
import { ROUTES, setupHref } from "@/lib/constants/routes";
import { money, wholePct } from "@/lib/format";
import { useClaimWindow } from "@/lib/pool/use-claim-window";
import { sharesValueOf, useLp } from "@/lib/pool/use-lp";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { cn } from "@/lib/utils";
import { ClaimPanel, DepositPanel, RedeemPanel } from "./pool-panels";

const MS_PER_SECOND = 1000n;
const APR_SOURCE = "Last 7 days of fees the pool kept and traders’ results, annualised from its indexed events.";

/** The pool's pre-approval disclosures as compact rows; the ⓘ shows the one-line reason. */
const DISCLOSURES = [
  { title: "Capital at risk", body: "The pool pays traders’ profits; its value can fall." },
  { title: "24 h to redeem", body: "Shares wait 24 hours in escrow before a claim." },
  { title: "Claims need open markets", body: "Claims work only while every market is open." },
  { title: "Value moves until claim", body: "You receive the value at claim time, not at request." },
  { title: "Entry and exit prices differ", body: "Deposits count open trader losses; claims don’t." },
  { title: "APR is past, not promised", body: "Last 7 days of fees and trader results." },
] as const;

type Panel = { kind: "deposit" } | { kind: "redeem" } | { kind: "claim"; request: LpRedeemView } | undefined;

function Disclosures() {
  const [open, setOpen] = useState<string>();
  return (
    <section aria-label="Before you deposit">
      {DISCLOSURES.map((d) => (
        <div key={d.title}>
          <button
            type="button"
            aria-expanded={open === d.title}
            onClick={() => setOpen(open === d.title ? undefined : d.title)}
            className="flex min-h-11 w-full items-center justify-between text-left text-row text-text-2 hover:text-foreground"
          >
            {d.title}
            <Info className="size-4 text-text-3" aria-hidden />
          </button>
          {open === d.title ? <p className="pb-2 text-meta text-text-3">{d.body}</p> : null}
        </div>
      ))}
    </section>
  );
}

function outcomeWords(
  record: { plannedActions: string[]; kind: string; reviewedIntent: Record<string, string> } | undefined,
) {
  const amount = record?.reviewedIntent.amount;
  if (record?.plannedActions.includes("lpDeposit"))
    return { pending: "Depositing", success: amount ? `Deposited ${money(BigInt(amount))}` : "Deposited" };
  if (record?.kind === "lpRequestRedeem") return { pending: "Requesting", success: "Redemption requested" };
  return { pending: "Claiming", success: "Claimed" };
}

export function PoolScreen() {
  const lp = useLp();
  const window = useClaimWindow();
  const accepted = useTermsAccepted(lp.address);
  const outcome = useSettledOutcome(lp.trace.events);
  const [panel, setPanel] = useState<Panel>();
  const v = lp.snapshot;
  const apr = known(lp.apr);
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const showingOutcome = lp.trace.events.length > 0;

  if (!lp.address)
    return (
      <Column>
        <PageHeader title="Senryo pool" back={ROUTES.home} />
        <div className="grid gap-3 py-6 text-center">
          <p className="text-row">Earn from the pool</p>
          <Button asChild size="xl">
            <Link href={ROUTES.welcome}>Create account</Link>
          </Button>
        </div>
      </Column>
    );

  return (
    <Column className="grid gap-6">
      <PageHeader title="Senryo pool" back={ROUTES.home} />
      {showingOutcome ? (
        <OperationStatus
          events={lp.trace.events}
          record={lp.trace.record}
          running={lp.trace.running}
          outcome={outcome}
          words={{
            ...ORDER_WORDS,
            thing: "pool transaction",
            again: "send it again",
            back: "Back",
            ...outcomeWords(lp.trace.record),
          }}
          onDone={() => {
            lp.trace.reset();
            setPanel(undefined);
          }}
          onLeave={() => setPanel(undefined)}
        />
      ) : null}
      <div className={cn("grid gap-6", showingOutcome && "hidden")}>
        {!v ? (
          lp.vault.status === "failed" ? (
            <QuietLine>Couldn’t read the pool</QuietLine>
          ) : (
            <Skeleton className="h-40 w-full" />
          )
        ) : (
          <>
            <section className="grid gap-1">
              <div className="flex items-center gap-2">
                <EntityMark id={ids.venue("senryo")} size={MARK_ROW} decorative />
                <span className="text-row">Senryo pool</span>
              </div>
              <p className="pt-2 text-meta text-text-3">Your investment</p>
              <AmountHero text={money(v.sharesValue + v.pendingValue)} />
              <span
                title={APR_SOURCE}
                className="mt-1 inline-flex items-center gap-1 justify-self-start rounded-sm bg-up-surface px-2 py-1 text-meta text-up"
              >
                {apr ? `APR ${wholePct(apr.bps)} · ${apr.days}d` : "APR —"}
                <Info className="size-3.5" aria-label={APR_SOURCE} />
              </span>
            </section>
            <dl className="grid grid-cols-3 gap-3 rounded-md bg-raised-2 p-4">
              {[
                ["Pool value", money(v.totalAssets, 0)],
                ["In use", lp.utilisationBps === undefined ? "—" : wholePct(lp.utilisationBps)],
                ["Cap left", money(v.tvlCap > v.totalAssets ? v.tvlCap - v.totalAssets : 0n, 0)],
              ].map(([k, val]) => (
                <div key={k}>
                  <dd className="text-row tnum">{val}</dd>
                  <dt className="text-meta text-text-3">{k}</dt>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-2">
              {accepted ? (
                <Button size="xl" onClick={() => setPanel({ kind: "deposit" })}>
                  Deposit
                </Button>
              ) : (
                <Button asChild size="xl">
                  <Link href={setupHref(ROUTES.pool)}>Deposit</Link>
                </Button>
              )}
              {v.shares > 0n ? (
                <Button size="xl" variant="secondary" onClick={() => setPanel({ kind: "redeem" })}>
                  Redeem
                </Button>
              ) : null}
            </div>
            {panel?.kind === "deposit" ? <DepositPanel lp={lp} pool={v} /> : null}
            {panel?.kind === "redeem" ? <RedeemPanel lp={lp} pool={v} /> : null}
            {panel?.kind === "claim" ? <ClaimPanel lp={lp} pool={v} request={panel.request} /> : null}
            {v.pending.length > 0 ? (
              <section className="grid">
                <h2 className="text-section-title">Redemptions</h2>
                {v.pending.map((r) => {
                  const ready = r.claimableAt <= nowSec;
                  const status = !ready
                    ? `Claim ${durationUntil(r.claimableAt, nowSec)}`
                    : v.allMarketsOpen
                      ? "Ready · Claim"
                      : window.opensAt
                        ? `Claim opens ${utcSlotLabel(window.opensAt)}`
                        : "Waiting for prices";
                  return (
                    <ListRow
                      key={String(r.requestId)}
                      title={`≈ ${money(sharesValueOf(r.shares, v))}`}
                      detail={status}
                      detailClassName={ready && v.allMarketsOpen ? "text-up" : "text-text-3"}
                      value=""
                      onClick={() => setPanel({ kind: "claim", request: r })}
                    />
                  );
                })}
              </section>
            ) : null}
            {!v.requestsComplete ? <p className="text-meta text-warn">Updating…</p> : null}
            <Disclosures />
            <p className={ACTIVE_NETWORK.key === "testnet" ? "text-meta text-practice" : "text-meta text-mainnet"}>
              {ACTIVE_NETWORK.key === "testnet" ? "Practice · Paper money" : "Mainnet · Real money"}
            </p>
          </>
        )}
      </div>
    </Column>
  );
}
