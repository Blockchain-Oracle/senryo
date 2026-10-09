"use client";
/**
 * One question (`/app/event/?id=`; S8.7, D-296): the card to call it, the rules the committee answers by, when calls
 * close and when answers count, and each member's answer — what it read, the score it saw, its statement re-hashed
 * here against the hash the chain recorded — with every transaction. Labelled as what it is: settled by named
 * signers, not a price feed.
 */
import type { EventAnswerView } from "@senryo/api-client";
import {
  committeeLine,
  feeLine,
  leagueName,
  REFUND_RULE,
  sideWord,
  statementChecks,
  statementRead,
  statusLine,
} from "@senryo/calls";
import { useEventsFlow } from "@senryo/calls/react";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useEventDetail } from "@senryo/query";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";
import { EventCard } from "./EventCard";

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const MS_PER_SECOND = 1000;
const when = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function EventDetail() {
  const id = useSearchParams().get("id") ?? "";
  const valid = BYTES32.test(id);
  const account = useAccount();
  const now = useServerSeconds();
  const detail = useEventDetail(valid ? id : null);
  const flow = useEventsFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to call",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  if (!valid) return <p className="text-body text-text-2">This link doesn't name a question.</p>;
  if (detail.status === "unknown") return <p className="text-body text-text-2">Reading the question…</p>;
  if (detail.status === "failed") {
    return <p className="text-body text-text-2">This question can't be read right now · it retries on its own</p>;
  }
  const { event: e, committee, answers } = detail.value;
  const byMember = new Map(answers.map((a) => [a.member.toLowerCase(), a]));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-meta text-text-3">{leagueName(e.league)} · Yes / No · Practice</span>
          <h1 className="font-semibold text-page-title">{e.question}</h1>
          <span className="text-body text-text-2">{statusLine(e, now)}</span>
        </div>
        <section aria-label="Rules" className="flex flex-col gap-2">
          <h2 className="font-semibold text-section-title">The rule</h2>
          <p className="text-body">{e.rules}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
            <dt className="text-text-3">Starts</dt>
            <dd className="tnum">{when(e.startsAt)}</dd>
            <dt className="text-text-3">Calls close</dt>
            <dd className="tnum">{when(e.closesAt)}</dd>
            <dt className="text-text-3">Answers count</dt>
            <dd className="tnum">
              {when(e.answerFrom)} – {when(e.answerBy)}
            </dd>
            <dt className="text-text-3">Terms hash</dt>
            <dd className="truncate font-mono">{e.termsHash}</dd>
          </dl>
          <p className="text-meta text-text-3">{feeLine(e.feeBps)}</p>
          {e.listedTx ? <TxLink chainId={flow.chainId} hash={e.listedTx} label="Listed on chain" /> : null}
        </section>
        <section aria-label="The committee's answers" className="flex flex-col gap-2">
          <h2 className="font-semibold text-section-title">The committee</h2>
          <p className="text-meta text-text-2">{committeeLine(committee)}</p>
          <p className="text-meta text-text-3">{REFUND_RULE}</p>
          <ul className="flex flex-col divide-y divide-border">
            {committee.members.map((m) => (
              <MemberRow
                key={m.address}
                name={m.name}
                reads={m.reads}
                address={m.address}
                answer={byMember.get(m.address.toLowerCase()) ?? null}
                chainId={flow.chainId}
              />
            ))}
          </ul>
        </section>
      </div>
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <EventCard event={e} flow={flow} now={now} blocked={flow.limits ? null : "Events are Practice only"} />
        <Link href="/app/events/" className="text-meta text-text-2 underline hover:text-foreground">
          Every question
        </Link>
      </div>
    </div>
  );
}

function MemberRow(p: {
  name: string;
  reads: string;
  address: string;
  answer: EventAnswerView | null;
  chainId: ChainId;
}) {
  const a = p.answer;
  const read = a ? statementRead(a) : null;
  const checks = a ? statementChecks(a) : false;
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-row-title">{p.name}</span>
        <span className={cn("font-semibold text-row-title", a ? (a.yes ? "text-up" : "text-down") : "text-text-3")}>
          {a ? sideWord(a.yes) : "Not yet"}
        </span>
      </div>
      <span className="text-meta text-text-3">
        Reads {p.reads} · {shortAddress(p.address)}
      </span>
      {a && read ? (
        <>
          <span className="text-meta text-text-2">
            Saw “{read.read}” on{" "}
            <a href={read.source} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              {new URL(read.source).host}
            </a>
          </span>
          <span className="flex items-center gap-1 text-meta">
            {checks ? (
              <Check aria-hidden className="size-3.5 text-up" />
            ) : (
              <X aria-hidden className="size-3.5 text-down" />
            )}
            <span className={checks ? "text-text-2" : "text-down"}>
              {checks ? "Statement re-hashed here: matches the chain" : "Statement doesn't match its hash"}
            </span>
          </span>
          {a.txHash ? (
            <TxLink chainId={p.chainId} hash={a.txHash} label="Answer on chain" />
          ) : (
            <span className="text-meta text-text-3">Signed · on its way to the chain</span>
          )}
        </>
      ) : null}
    </li>
  );
}

function TxLink(p: { chainId: ChainId; hash: string; label: string }) {
  return (
    <a
      href={explorerTxUrl(p.chainId, p.hash)}
      target="_blank"
      rel="noreferrer"
      className="text-meta text-text-2 underline hover:text-foreground"
    >
      {p.label}
    </a>
  );
}
