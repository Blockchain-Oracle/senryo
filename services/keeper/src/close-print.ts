/**
 * How a window's close gets proved, for the settle and parlay jobs (13 Oct incident): within the verifier's admission
 * the archived print proves it; after admission the chain refuses any new print (`PrintTooLate`), so the close counts
 * only if the chain already holds it — `ensurePrint` then returns it and ignores the proof — and otherwise the window
 * voids and refunds (`voidExpired`). The keeper used to keep sending the archived proof after admission: every try a
 * no-op that still paid its whole gas limit, until the wallet ran dry.
 */
import { addressOf, type Hex } from "@senryo/chain";
import { windowsAbi } from "@senryo/contracts/abis";
import type { KeeperContext } from "./context.ts";

/** Proof bytes for a close the chain already holds (`ensurePrint` returns the recorded print without reading them). */
const RECORDED = "0x" as Hex;

export type CloseProof = { kind: "prove"; proof: Hex } | { kind: "void" } | { kind: "wait" };

export async function closeRecorded(ctx: KeeperContext, verifier: Hex, feedId: Hex, t: number): Promise<boolean> {
  const p = await ctx.read.readContract({
    address: addressOf(ctx.chainId, "Windows"),
    abi: windowsAbi,
    functionName: "printOf",
    args: [verifier, feedId, t],
  });
  return Number(p.publishTime) !== 0;
}

/** What to send for a window's close at `now`: the proof, a void, or nothing yet (the print is on its way). */
export async function closeProof(
  ctx: KeeperContext,
  c: { verifier: Hex; feedId: Hex; expiry: number; admissionSec: number; archived: Hex | null; now: number },
): Promise<CloseProof> {
  if (c.now <= c.expiry + c.admissionSec) return c.archived ? { kind: "prove", proof: c.archived } : { kind: "wait" };
  if (await closeRecorded(ctx, c.verifier, c.feedId, c.expiry)) return { kind: "prove", proof: c.archived ?? RECORDED };
  return { kind: "void" };
}
