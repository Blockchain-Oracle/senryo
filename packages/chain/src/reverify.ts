/**
 * Re-verify a print yourself (S7.7, D-288): the one place a client reads the chain directly, on the Proof page's button
 * only. From the transaction that recorded the print it decodes the proof (`aggregate3 → ensurePrint`), asks the
 * verifier again with `eth_call` — the same Pyth (or basket) proof, checked by the same contract now — and compares
 * the answer with what `Windows` stored and what the api said. Nothing here trusts our api or our archive.
 */
import type { ChainId, MarketSpec } from "@senryo/config";
import { pythPrintVerifierAbi, windowsAbi } from "@senryo/contracts/abis";
import { type Address, decodeFunctionData, type Hex, multicall3Abi } from "viem";
import { createReadClient } from "./clients.ts";
import { addressOf, verifierOf } from "./contracts.ts";

export interface PrintFacts {
  priceE8: bigint;
  confE8: bigint;
  publishTime: number;
}

export type ReverifyResult =
  | {
      state: "verified" | "differs";
      /** What the verifier answers now for the proof in the transaction. */
      recomputed: PrintFacts;
      /** What `Windows.printOf` stored when the print was recorded. */
      stored: PrintFacts;
      /** The api's numbers agree with the chain's. */
      apiAgrees: boolean;
    }
  | { state: "no-proof"; reason: string };

/** The `ensurePrint` / `recordPrint` call for `(verifier, feedId, t)` inside a recording transaction. */
function proofIn(input: Hex, verifier: Address, feedId: Hex, t: number): Hex | undefined {
  const calls: { callData: Hex }[] = [];
  try {
    const outer = decodeFunctionData({ abi: multicall3Abi, data: input });
    if (outer.functionName === "aggregate3") calls.push(...outer.args[0]);
  } catch {
    calls.push({ callData: input });
  }
  for (const c of calls) {
    try {
      const d = decodeFunctionData({ abi: windowsAbi, data: c.callData });
      if (d.functionName !== "ensurePrint" && d.functionName !== "recordPrint") continue;
      const [v, f, at, proof] = d.args as [Address, Hex, number, Hex];
      if (v.toLowerCase() === verifier.toLowerCase() && f.toLowerCase() === feedId.toLowerCase() && Number(at) === t) {
        return proof;
      }
    } catch {}
  }
  return undefined;
}

export async function reverifyPrint(
  chainId: ChainId,
  market: MarketSpec,
  feedId: Hex,
  t: number,
  txHash: Hex,
  api: PrintFacts,
): Promise<ReverifyResult> {
  const client = createReadClient(chainId);
  const verifier = verifierOf(chainId, market);
  const tx = await client.getTransaction({ hash: txHash });
  const proof = proofIn(tx.input, verifier, feedId, t);
  if (!proof) return { state: "no-proof", reason: "The transaction carries no proof for this print." };
  const fee = await client.readContract({
    address: verifier,
    abi: pythPrintVerifierAbi,
    functionName: "fee",
    args: [proof],
  });
  const { result } = await client.simulateContract({
    address: verifier,
    abi: pythPrintVerifierAbi,
    functionName: "verifyPrint",
    args: [proof, feedId, t],
    value: fee,
    account: tx.from,
  });
  const [priceE8, confE8, publishTime] = result;
  const stored = await client.readContract({
    address: addressOf(chainId, "Windows"),
    abi: windowsAbi,
    functionName: "printOf",
    args: [verifier, feedId, t],
  });
  const recomputed = { priceE8: BigInt(priceE8), confE8: BigInt(confE8), publishTime: Number(publishTime) };
  const onChain = {
    priceE8: BigInt(stored.priceE8),
    confE8: BigInt(stored.confE8),
    publishTime: Number(stored.publishTime),
  };
  const same = (a: PrintFacts, b: PrintFacts) =>
    a.priceE8 === b.priceE8 && a.confE8 === b.confE8 && a.publishTime === b.publishTime;
  return {
    state: same(recomputed, onChain) ? "verified" : "differs",
    recomputed,
    stored: onChain,
    apiAgrees: same(onChain, api),
  };
}
