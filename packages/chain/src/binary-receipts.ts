import type { BinaryEnvironment, BinaryManifest } from "@senryo/config";
import { senryoBinaryV1Abi } from "@senryo/contracts";
import { decodeEventLog, type Hex, type TransactionReceipt } from "viem";
import { assertBinaryManifest } from "./binary-reads.ts";
import type { ReceiptFact } from "./receipt-facts.ts";

const EVENTS = new Set(["Bought", "Sold", "SharesClaimed", "LiquidityClaimed", "Withdrawal", "WithdrawalFailed"]);
export interface BinaryFact extends ReceiptFact {
  id: string;
  blockHash: Hex;
  blockNumber: string;
  transactionHash: Hex;
  logIndex: number;
}
/** Canonical target + environment + event identity. A status=success receipt alone proves no payment. */
export function binaryReceiptFacts(receipt: TransactionReceipt, m: BinaryManifest, e: BinaryEnvironment): BinaryFact[] {
  assertBinaryManifest(m, e);
  if (receipt.status !== "success") return [];
  const facts: BinaryFact[] = [],
    seen = new Set<string>();
  for (const log of receipt.logs) {
    if (
      log.removed ||
      log.address.toLowerCase() !== m.contract.toLowerCase() ||
      log.logIndex === null ||
      log.blockHash !== receipt.blockHash ||
      log.transactionHash !== receipt.transactionHash
    )
      continue;
    const id = `${m.environmentId}:${m.chainId}:${m.contract.toLowerCase()}:${receipt.transactionHash}:${log.logIndex}`;
    if (seen.has(id)) continue;
    try {
      const event = decodeEventLog({ abi: senryoBinaryV1Abi, data: log.data, topics: log.topics, strict: true });
      if (!EVENTS.has(event.eventName)) continue;
      const values: Record<string, string> = { environmentId: m.environmentId, configHash: m.configHash };
      for (const [key, value] of Object.entries(event.args ?? {}))
        if (["string", "bigint", "boolean", "number"].includes(typeof value)) values[key] = String(value);
      facts.push({
        id,
        event: event.eventName,
        contract: log.address,
        values,
        blockHash: receipt.blockHash,
        blockNumber: String(receipt.blockNumber),
        transactionHash: receipt.transactionHash,
        logIndex: log.logIndex,
      });
      seen.add(id);
    } catch {
      /* unrelated/malformed logs are not execution facts */
    }
  }
  return facts;
}
export type BinaryOutcome = "bought" | "credited-sale" | "credited-claim" | "paid" | "withdrawal-failed" | "unknown";
export function binaryReceiptOutcome(
  facts: readonly ReceiptFact[],
  owner: string,
  operationId: string,
): { outcome: BinaryOutcome; monWei: bigint; sharesWei: bigint } {
  const own = facts.filter(
    (f) =>
      f.values.owner?.toLowerCase() === owner.toLowerCase() &&
      f.values.operationId?.toLowerCase() === operationId.toLowerCase(),
  );
  if (own.length !== 1) return { outcome: "unknown", monWei: 0n, sharesWei: 0n };
  const f = own[0];
  if (!f) return { outcome: "unknown", monWei: 0n, sharesWei: 0n };
  const outcome: BinaryOutcome =
    f.event === "Bought"
      ? "bought"
      : f.event === "Sold"
        ? "credited-sale"
        : f.event === "SharesClaimed"
          ? "credited-claim"
          : f.event === "Withdrawal"
            ? "paid"
            : f.event === "WithdrawalFailed"
              ? "withdrawal-failed"
              : "unknown";
  return {
    outcome,
    monWei: BigInt(f.values.monWei ?? f.values.monCreditWei ?? "0"),
    sharesWei: BigInt(f.values.sharesWei ?? "0"),
  };
}
export interface BinaryBasis {
  sharesWei: bigint;
  costWei: bigint;
  realizedWei: bigint;
}
export interface BinaryAccounting {
  positions: Record<string, { up: BinaryBasis; down: BinaryBasis }>;
  creditWei: bigint;
  transferredWei: bigint;
  claimRealizedWei: bigint;
}
function amount(values: Record<string, string>, key: string): bigint {
  const raw = values[key];
  if (!raw || !/^\d+$/.test(raw)) throw new Error("binary: malformed financial fact");
  return BigInt(raw);
}
const emptyBasis = (): BinaryBasis => ({ sharesWei: 0n, costWei: 0n, realizedWei: 0n });
/** Rebuild from the canonical event set after rollback. Never increment stale state across a reorg. */
export function rebuildBinaryAccounting(canonicalFacts: readonly BinaryFact[], owner: string): BinaryAccounting {
  const out: BinaryAccounting = { positions: {}, creditWei: 0n, transferredWei: 0n, claimRealizedWei: 0n };
  const seen = new Map<string, string>();
  const sources = new Set(
    canonicalFacts.map((f) => `${f.values.environmentId}:${f.contract.toLowerCase()}:${f.values.configHash}`),
  );
  if (sources.size > 1) throw new Error("binary: mixed accounting environments");
  for (const f of [...canonicalFacts].sort((a, b) =>
    BigInt(a.blockNumber) < BigInt(b.blockNumber)
      ? -1
      : BigInt(a.blockNumber) > BigInt(b.blockNumber)
        ? 1
        : a.logIndex - b.logIndex,
  )) {
    const previous = seen.get(f.id);
    if (previous) {
      if (previous !== f.blockHash) throw new Error("binary: conflicting canonical block");
      continue;
    }
    seen.set(f.id, f.blockHash);
    if ((f.values.owner ?? f.values.beneficiary)?.toLowerCase() !== owner.toLowerCase()) continue;
    const v = f.values;
    const key = `${v.environmentId}:${f.contract.toLowerCase()}:${v.roundId}`;
    if (f.event === "Bought" || f.event === "Sold" || f.event === "SharesClaimed") {
      out.positions[key] ??= { up: emptyBasis(), down: emptyBasis() };
      const p = out.positions[key];
      if (f.event === "SharesClaimed") {
        if (amount(v, "up") !== p.up.sharesWei || amount(v, "down") !== p.down.sharesWei)
          throw new Error("binary: incomplete basis history");
        const credit = amount(v, "monCreditWei");
        out.claimRealizedWei += credit - p.up.costWei - p.down.costWei;
        out.creditWei += credit;
        p.up.sharesWei = 0n;
        p.up.costWei = 0n;
        p.down.sharesWei = 0n;
        p.down.costWei = 0n;
      } else {
        const b = v.isUp === "true" ? p.up : p.down,
          shares = amount(v, "sharesWei");
        if (f.event === "Bought") {
          b.sharesWei += shares;
          b.costWei += amount(v, "monWei");
        } else {
          if (shares <= 0n || shares > b.sharesWei) throw new Error("binary: incomplete sale history");
          const basis = shares === b.sharesWei ? b.costWei : (b.costWei * shares) / b.sharesWei,
            credit = amount(v, "monCreditWei");
          b.sharesWei -= shares;
          b.costWei -= basis;
          b.realizedWei += credit - basis;
          out.creditWei += credit;
        }
      }
    } else if (f.event === "LiquidityClaimed") out.creditWei += amount(v, "monCreditWei");
    else if (f.event === "Withdrawal") {
      const paid = amount(v, "monWei");
      out.creditWei -= paid;
      out.transferredWei += paid;
      if (out.creditWei < 0n) throw new Error("binary: incomplete credit history");
    }
    // Failed withdrawal preserves credit and realizes no further P&L.
  }
  return out;
}
