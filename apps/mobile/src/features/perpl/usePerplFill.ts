/**
 * What a finalized Perpl order actually did (flow book C4 step 5, Part F9): the order step's receipt, read back by its
 * hash once the journal says it finalized, decoded from the Exchange's own events (`decodePerplOrder`) — never from the
 * receipt status, which is 1 for an IOC that matched nobody. Works for a trace restored after a kill: the hash and the
 * network come from the operation record, so a switch to the other network never reads the receipt on the wrong chain.
 */
import { decodePerplOrder, type PerplOrderOutcome } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type OperationRecord, perplReadOf, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { sharedRead } from "~/lib/account/sender";

export function perplOrderHash(record: OperationRecord | undefined): `0x${string}` | undefined {
  const step = record?.steps.find((s) => s.action === "perplOrder" && s.outcome === "completed" && s.hash);
  return step?.hash as `0x${string}` | undefined;
}

export function usePerplFill(record: OperationRecord | undefined) {
  const env = useQueryEnv();
  const chainId = (record?.chainId ?? env.chainId) as ChainId;
  const hash = perplOrderHash(record);
  const query = useQuery({
    queryKey: ["perpl", chainId, "fill", hash ?? ""] as const,
    enabled: hash !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<PerplOrderOutcome> => {
      const read = chainId === env.chainId ? perplReadOf(env) : sharedRead(chainId);
      const receipt = await read.getTransactionReceipt({ hash: hash as `0x${string}` });
      return decodePerplOrder(receipt.logs, chainId);
    },
  });
  return { hash, fill: query.data, failed: query.isError, retry: () => void query.refetch() };
}
