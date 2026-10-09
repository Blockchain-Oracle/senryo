"use client";
import type { WindowProof as Proof } from "@senryo/api-client";
/**
 * The window a call lived in, proved (the phone's `WindowProof`; the full re-verify page is S7): the line and the close
 * print with the transactions that posted them, where the close landed against the line, and how the crowd called it
 * (`@senryo/calls` `proofFacts`). Facts only: no winner is inferred beyond the prints.
 */
import { closeUnposted, proofFacts } from "@senryo/calls";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { usePrint, useWindowProof } from "@senryo/query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

function ProofBody({ p, chainId }: { p: Proof; chainId: ChainId }) {
  const archived = usePrint(p.symbol, closeUnposted(p) ? p.expiry : undefined);
  const { heading, facts } = proofFacts(p, "value" in archived ? archived.value : undefined);
  return (
    <section className="flex flex-col gap-1" aria-labelledby="proof-heading">
      <div className="flex items-baseline justify-between gap-3 pb-1">
        <h3 id="proof-heading" className="font-semibold text-section-title">
          The window
        </h3>
        <span className="text-meta text-text-3">{heading}</span>
      </div>
      {facts.map((f) => {
        const body = (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-row">{f.label}</span>
              {f.detail ? (
                <span className="flex items-center gap-1 text-meta text-text-3">
                  {f.detail}
                  {f.tx ? (
                    <>
                      {" · View transaction"}
                      <ExternalLink aria-hidden className="size-3" />
                    </>
                  ) : null}
                </span>
              ) : null}
            </span>
            <span className="text-right font-semibold text-row">{f.value}</span>
          </>
        );
        return f.tx ? (
          <a
            key={f.label}
            href={explorerTxUrl(chainId, f.tx)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center gap-3 rounded-md hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {body}
          </a>
        ) : (
          <div key={f.label} className="flex min-h-14 items-center gap-3">
            {body}
          </div>
        );
      })}
      <Link
        href={`/proof/w/?id=${p.windowId}&chainId=${chainId}`}
        className="self-start pt-1 font-semibold text-link text-meta"
      >
        Full proof and re-verify ›
      </Link>
    </section>
  );
}

export function WindowProof({ windowId, chainId }: { windowId: `0x${string}`; chainId: ChainId }) {
  const proof = useWindowProof(windowId);
  if (!("value" in proof) || !proof.value)
    return (
      <p className="text-meta text-text-3">
        {proof.status === "failed"
          ? "Couldn't load the window's prints."
          : "value" in proof
            ? "The window's prints appear a few seconds after its first call."
            : "Loading the window's prints…"}
      </p>
    );
  return <ProofBody p={proof.value} chainId={chainId} />;
}
