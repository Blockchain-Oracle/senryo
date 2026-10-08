import { type BinaryEnvironment, type BinaryManifest, type ChainId, PERPL_EXCHANGE } from "@senryo/config";
import { decodeEventLog, erc20Abi, type TransactionReceipt } from "viem";
import { binaryReceiptFacts } from "./binary-receipts.ts";
import { addressOf, CONTRACT_ABIS, isDeployed } from "./contracts.ts";
import { perplReceiptFacts } from "./perpl/fills.ts";

export interface ReceiptFact {
  event: string;
  contract: string;
  values: Record<string, string>;
}
/** Decode only the actual call target and deployed financial contracts, never a lookalike event from another address. */
export function receiptFacts(
  receipt: TransactionReceipt,
  chainId: ChainId,
  target: string,
  binary?: { manifest: BinaryManifest; environment: BinaryEnvironment },
): ReceiptFact[] {
  const facts: ReceiptFact[] = [];
  const perpl = PERPL_EXCHANGE[chainId].toLowerCase();
  for (const log of receipt.logs) {
    // Perpl's Exchange logs are decoded below with its own ABI (the wallet's account only).
    if (log.address.toLowerCase() === perpl) continue;
    const name = (["SenryoCore", "LpVault"] as const).find(
      (name) => isDeployed(chainId, name) && addressOf(chainId, name).toLowerCase() === log.address.toLowerCase(),
    );
    if (!name && log.address.toLowerCase() !== target.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: name ? CONTRACT_ABIS[name] : erc20Abi, data: log.data, topics: log.topics });
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.args ?? {})) {
        if (["bigint", "string", "boolean", "number"].includes(typeof value)) values[key] = String(value);
      }
      facts.push({ event: event.eventName, contract: log.address, values });
    } catch {
      /* Non-financial or unsupported logs remain on the explorer. */
    }
  }
  const binaryFacts =
    binary && binary.manifest.chainId === chainId && binary.manifest.contract.toLowerCase() === target.toLowerCase()
      ? binaryReceiptFacts(receipt, binary.manifest, binary.environment)
      : [];
  return [...facts, ...perplReceiptFacts(receipt.logs, chainId), ...binaryFacts];
}
