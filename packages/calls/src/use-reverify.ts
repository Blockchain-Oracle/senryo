/**
 * Re-verify a print yourself, both apps (S7.7, D-288; stage P2): the Proof page's one button that reads the chain
 * directly (`reverifyPrint` — decode the proof from the transaction that recorded the print, ask the verifier again)
 * and the answer in words, green only when the verifier, the chain and the page all agree.
 */
import type { WindowProof } from "@senryo/api-client";
import { type ChainId, feedIdOf, MARKETS } from "@senryo/config";
import { priceText } from "@senryo/core";
import { useState } from "react";
import { unitOf } from "./markets.ts";
import { utcClock } from "./proof.ts";

export type ProofPrint = NonNullable<WindowProof["open"]>;
export type ReverifyState = { kind: "idle" | "busy" } | { kind: "done"; text: string; ok: boolean };

export function useReverify(p: WindowProof, print: ProofPrint, t: number, chainId: ChainId) {
  const [state, setState] = useState<ReverifyState>({ kind: "idle" });
  const run = async () => {
    const market = MARKETS.find((m) => m.symbol === p.symbol);
    if (!market) return;
    setState({ kind: "busy" });
    try {
      // Loaded on the tap: nothing else on a page reads the chain.
      const { reverifyPrint } = await import("@senryo/chain");
      const r = await reverifyPrint(chainId, market, feedIdOf(market), t, print.txHash, {
        priceE8: print.priceE8,
        confE8: print.confE8,
        publishTime: print.publishTime,
      });
      if (r.state === "no-proof") {
        setState({ kind: "done", text: r.reason, ok: false });
        return;
      }
      const said = `${priceText(r.recomputed.priceE8, unitOf(p.symbol))} at ${utcClock(r.recomputed.publishTime)}`;
      setState({
        kind: "done",
        ok: r.state === "verified" && r.apiAgrees,
        text:
          r.state === "verified"
            ? `Re-verified: the verifier answers ${said}, the same as stored on chain${r.apiAgrees ? " and shown here" : " — but not what this page showed"}.`
            : `The verifier now answers ${said}, which differs from what is stored on chain.`,
      });
    } catch (error) {
      setState({ kind: "done", ok: false, text: `Couldn't re-verify: ${(error as Error).message}` });
    }
  };
  return { state, run };
}
