"use client";
/**
 * The board's side column (S8.7, D-296 labelling): how a question settles — the committee named, each signer with what
 * it reads, the quorum and the refund rule, the fee — then your calls, newest first; rows, not boxes.
 */
import type { CommitteeView, EventCallView } from "@senryo/api-client";
import { callResultText, committeeLine, feeLine, REFUND_RULE } from "@senryo/calls";
import { shortAddress } from "@senryo/core";
import Link from "next/link";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { cn } from "@/lib/utils";
import { eventHref } from "./EventCard";

export function HowItSettles({ committee, feeBps }: { committee: CommitteeView | null; feeBps: number }) {
  return (
    <section aria-label="How it settles" className="flex flex-col gap-2">
      <h2 className="font-semibold text-section-title">How it settles</h2>
      {committee ? (
        <>
          <p className="text-meta text-text-2">{committeeLine(committee)}</p>
          <ul className="flex flex-col divide-y divide-border">
            {committee.members.map((m) => (
              <li key={m.address} className="flex items-baseline justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-row-title">{m.name}</span>
                  <span className="truncate text-meta text-text-3">Reads {m.reads}</span>
                </span>
                <span className="tnum text-meta text-text-3">{shortAddress(m.address)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-meta text-text-2">{REFUND_RULE}</p>
      <p className="text-meta text-text-3">
        {feeLine(feeBps)} · Practice, test dollars · calls close at the start, no cash-out
      </p>
    </section>
  );
}

export function YourEventCalls({ calls, signedIn }: { calls: readonly EventCallView[]; signedIn: boolean }) {
  return (
    <section aria-label="Your event calls" className="flex flex-col gap-2">
      <h2 className="font-semibold text-section-title">Your calls</h2>
      {calls.length === 0 ? (
        signedIn ? (
          <p className="text-body text-text-2">Calls you make show here.</p>
        ) : (
          <SignInPrompt line="Sign in to call." compact />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {calls.map((c) => (
            <li key={c.ticketId.toString()} className="py-3">
              <Link
                href={eventHref(c.eventId)}
                className="flex items-baseline justify-between gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="min-w-0 truncate text-row-title">{c.question}</span>
                <span
                  className={cn(
                    "tnum shrink-0 text-meta",
                    c.status === "won" ? "text-up" : c.status === "lost" ? "text-down" : "text-text-2",
                  )}
                >
                  {callResultText(c)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
