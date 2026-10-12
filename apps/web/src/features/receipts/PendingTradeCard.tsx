"use client";
/**
 * A trade between the tap and its fill (R5.11, Codex direction 12 §1): the slip's paper in its pending state — Senryo
 * with "N° Pending", then the request once it is sent ("Request 7AC19F42"); the market and side; "Signing…" or
 * "Waiting for the fill"; what was quoted. Its booked row takes its place in the list; the toast narrates.
 */
import type { PendingTrade } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { LoaderCircle } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import "./receipts.css";

const MARK = 24;
const DIGEST_SHOWN = 8;
const HEX_PREFIX = 2;

const STATUS: Record<PendingTrade["stage"], string> = {
  signing: "Signing…",
  pending: "Waiting for the fill",
  booked: "Booked",
};

export function PendingTradeCard({ run }: { run: PendingTrade }) {
  const hidden = usePrivacy();
  const status = STATUS[run.stage];
  const folio = run.digest
    ? `Request ${run.digest.slice(HEX_PREFIX, HEX_PREFIX + DIGEST_SHOWN).toUpperCase()}`
    : "N° Pending";
  return (
    <article className="receipt" aria-busy={run.stage !== "booked"} aria-label={`${run.title}, ${status}`}>
      <div className="receipt-body">
        <header className="receipt-head">
          <span className="receipt-brand">Senryo</span>
          <span className="receipt-folio">{folio}</span>
        </header>
        <div className="receipt-title">
          <EntityMark id={marketId(run.symbol)} size={MARK} decorative />
          <h3>{run.title}</h3>
        </div>
        <p className="receipt-status">
          {run.stage === "booked" ? null : <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {status}
        </p>
        <dl className="receipt-facts">
          {run.quoted.map((q) => (
            <div key={q.k} className="receipt-fact">
              <dt>{q.k} · quoted</dt>
              <dd>{q.money && hidden ? HIDDEN_AMOUNT : q.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
