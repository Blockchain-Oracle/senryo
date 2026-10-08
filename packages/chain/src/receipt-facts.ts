import type { ChainId } from "@senryo/config";
import { decodeEventLog, erc20Abi, type TransactionReceipt } from "viem";
import { addressOf, CONTRACT_ABIS, type ContractName, isDeployed } from "./contracts.ts";

export interface ReceiptFact {
  event: string;
  contract: string;
  values: Record<string, string>;
}

/**
 * Decode only the actual call target and our deployed contracts, never a lookalike event from another address.
 * The prediction-market contracts join `CONTRACT_ABIS` with the S2 deploy, so their events decode here then.
 */
export function receiptFacts(receipt: TransactionReceipt, chainId: ChainId, target: string): ReceiptFact[] {
  const facts: ReceiptFact[] = [];
  const ours = Object.keys(CONTRACT_ABIS) as ContractName[];
  for (const log of receipt.logs) {
    const name = ours.find(
      (n) => isDeployed(chainId, n) && addressOf(chainId, n).toLowerCase() === log.address.toLowerCase(),
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
  return facts;
}
