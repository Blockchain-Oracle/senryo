"use client";
/**
 * The trade slip on the web (R5.11, D-331): one paper for a call or a ride — Senryo and its folio, the market and side,
 * the realised figure with when it ended (what it pays, or its margin, while open), the stamp, the facts, the
 * perforation and the stub with the mode and the proof. White paper in either theme; amounts masked while balances
 * are hidden. `press` animates the stamp once (a result seen arriving).
 */
import { maskedSlip, type TradeSlip as Slip } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { ReceiptStamp } from "./ReceiptStamp";
import "./receipts.css";

const MARK = 24;

export function TradeSlip({ slip: raw, press = false }: { slip: Slip; press?: boolean }) {
  const hidden = usePrivacy();
  const slip = hidden ? maskedSlip(raw, HIDDEN_AMOUNT) : raw;
  return (
    <article className="receipt" aria-label={`${slip.title}, ${slip.folio}`}>
      <div className="receipt-body">
        <header className="receipt-head">
          <span className="receipt-brand">Senryo</span>
          <span className="receipt-folio">{slip.folio}</span>
        </header>
        <div className="receipt-title">
          <EntityMark id={marketId(slip.symbol)} size={MARK} decorative />
          <h2>{slip.title}</h2>
        </div>
        <div className="receipt-result">
          <div>
            <p className="receipt-label">{slip.figure.label}</p>
            <p
              className={cn(
                "receipt-figure",
                slip.figure.tone === "up" && "is-up",
                slip.figure.tone === "down" && "is-down",
              )}
            >
              {slip.figure.text}
            </p>
            <p className="receipt-when">
              {slip.when ?? (slip.kind === "call" ? "Open · settles at the close" : "Open")}
            </p>
          </div>
          {slip.stamp ? <ReceiptStamp stamp={slip.stamp} press={press} /> : <span className="receipt-open">Open</span>}
        </div>
        <dl className="receipt-facts">
          {slip.facts.map((f) => (
            <div key={f.k} className="receipt-fact">
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="receipt-perf" aria-hidden>
        <i />
        <i />
      </div>
      <footer className="receipt-stub">
        <span>{slip.mode}</span>
        {slip.proof ? (
          <a href={slip.proof.href} target="_blank" rel="noreferrer">
            {slip.proof.label}
          </a>
        ) : null}
      </footer>
    </article>
  );
}
