"use client";
/**
 * One window's proof (`/proof/w/?id=&chainId=`, S7.7, D-288): its line and close — each a Pyth print posted on chain
 * with its confidence, publish time and transaction, and a Re-verify that has your browser decode the proof from that
 * transaction and ask the verifier again — then every band's verdict as the chain recorded it beside the same rule
 * applied here, the crowd, where the money went, and every call in it with its receipt.
 */
import type { WindowProof } from "@senryo/api-client";
import { bandVerdicts, callTitle, crowdText, OUTCOME_WORD, unitOf, utcClock, utcTime, windowRow } from "@senryo/calls";
import { type ChainId, explorerTxUrl, feedIdOf, MARKETS } from "@senryo/config";
import { priceText, signedUsd, usd } from "@senryo/core";
import { useWindowProof } from "@senryo/query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PublicQuery } from "@/components/public/public-query";
import { cn } from "@/lib/utils";

const WINDOW_ID = /^0x[0-9a-fA-F]{64}$/;
type Print = NonNullable<WindowProof["open"]>;

function Reverify({ p, print, t, chainId }: { p: WindowProof; print: Print; t: number; chainId: ChainId }) {
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; text: string; ok: boolean }>({
    kind: "idle",
  });
  const run = async () => {
    const market = MARKETS.find((m) => m.symbol === p.symbol);
    if (!market) return;
    setState({ kind: "busy" });
    try {
      const { reverifyPrint } = await import("@senryo/chain");
      const r = await reverifyPrint(chainId, market, feedIdOf(market), t, print.txHash, {
        priceE8: print.priceE8,
        confE8: print.confE8,
        publishTime: print.publishTime,
      });
      if (r.state === "no-proof") setState({ kind: "done", text: r.reason, ok: false });
      else {
        const said = `${priceText(r.recomputed.priceE8, unitOf(p.symbol))} at ${utcClock(r.recomputed.publishTime)}`;
        setState({
          kind: "done",
          ok: r.state === "verified" && r.apiAgrees,
          text:
            r.state === "verified"
              ? `Re-verified: the verifier answers ${said}, the same as stored on chain${r.apiAgrees ? " and shown here" : " — but not what this page showed"}.`
              : `The verifier now answers ${said}, which differs from what is stored on chain.`,
        });
      }
    } catch (error) {
      setState({ kind: "done", ok: false, text: `Couldn't re-verify: ${(error as Error).message}` });
    }
  };
  if (state.kind === "done") return <p className={cn("text-meta", state.ok ? "text-up" : "text-down")}>{state.text}</p>;
  return (
    <button
      type="button"
      disabled={state.kind === "busy"}
      onClick={() => void run()}
      className="self-start rounded-full bg-secondary px-4 py-2 font-semibold text-button-compact disabled:opacity-50"
    >
      {state.kind === "busy" ? "Asking the chain…" : "Re-verify in your browser"}
    </button>
  );
}

function PrintBlock(props: { label: string; p: WindowProof; print: Print | null; t: number; chainId: ChainId }) {
  const { label, p, print, t, chainId } = props;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-section-title">{label}</h2>
        <span className="tnum font-semibold text-row">{print ? priceText(print.priceE8, unitOf(p.symbol)) : "—"}</span>
      </div>
      {print ? (
        <>
          <p className="text-meta text-text-3">
            Pyth print at {utcTime(print.publishTime)} · confidence ±{priceText(print.confE8, unitOf(p.symbol))} ·{" "}
            <a
              href={explorerTxUrl(chainId, print.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-link"
            >
              the transaction <ExternalLink aria-hidden className="size-3" />
            </a>
          </p>
          <Reverify p={p} print={print} t={t} chainId={chainId} />
        </>
      ) : (
        <p className="text-meta text-text-3">{p.state === "voided" ? "No print came in time." : "Not posted yet."}</p>
      )}
    </section>
  );
}

function Window({ windowId, chainId }: { windowId: `0x${string}`; chainId: ChainId }) {
  const proof = useWindowProof(windowId);
  if (proof.status === "failed") return <p className="text-body text-text-2">This window's proof didn't load.</p>;
  if (!("value" in proof)) return <div aria-busy className="h-64 animate-pulse rounded-lg bg-skeleton" />;
  const p = proof.value;
  if (!p) return <p className="text-body text-text-2">Nobody called in this window, so it has no proof.</p>;
  const row = windowRow({ ...p, openE8: p.open?.priceE8 ?? null, closeE8: p.close?.priceE8 ?? null });
  const verdicts = bandVerdicts(p);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-page-title">{row.title}</h1>
        <p className="text-body text-text-2">{row.detail}</p>
      </div>
      <PrintBlock label="The line" p={p} print={p.open} t={p.start} chainId={chainId} />
      <PrintBlock label="The close" p={p} print={p.close} t={p.expiry} chainId={chainId} />
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-section-title">Every band</h2>
        <ul className="flex flex-col">
          {verdicts.map((v) => (
            <li key={v.index} className="flex min-h-12 items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-row">{v.name}</span>
                <span className="truncate text-meta text-text-3">wins {v.where}</span>
              </span>
              <span className={cn("text-meta", v.agrees ? "text-text-2" : "text-down")}>
                {v.chain ? `${OUTCOME_WORD[v.chain]} on chain` : "Not settled"}
                {v.recomputed ? ` · ${OUTCOME_WORD[v.recomputed]} recomputed${v.agrees ? " ✓" : " ✗"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-semibold text-section-title">The crowd and the money</h2>
        <p className="text-body text-text-2">{crowdText(p)}</p>
        <p className="text-meta text-text-3">
          {usd(p.volume)} called · {usd(p.toHolders)} to callers · {usd(p.toPool)} to the pool
          {p.settledTx ? (
            <>
              {" · "}
              <a
                href={explorerTxUrl(chainId, p.settledTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                settlement
              </a>
            </>
          ) : null}
        </p>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-semibold text-section-title">Every call</h2>
        <ul className="flex flex-col">
          {p.callList.map((c) => (
            <li key={c.ticketId.toString()}>
              <Link
                href={`/call/?id=${c.ticketId}&chainId=${chainId}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 hover:bg-secondary"
              >
                <span className="text-row">{callTitle(c)}</span>
                <span className="tnum text-meta text-text-2">
                  {usd(c.stake)} · {c.pnl === null ? "open" : signedUsd(BigInt(c.pnl))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function WindowPage() {
  return (
    <PublicQuery loading="Loading the window…">
      {(chainId, params) => {
        const id = params.get("id") ?? "";
        if (!WINDOW_ID.test(id)) return <p className="text-body text-text-2">This link doesn't name a window.</p>;
        return <Window windowId={id as `0x${string}`} chainId={chainId} />;
      }}
    </PublicQuery>
  );
}
