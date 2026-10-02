/**
 * What a finalized Perpl order actually did (flow book C4 step 5, Part F9): the order step's receipt, read back by its
 * hash once the journal says it finalized, decoded from the Exchange's own events (`decodePerplOrder`) — never from the
 * receipt status, which is 1 for an IOC that matched nobody. Works for a trace restored after a kill: the hash comes
 * from the operation record.
 */
import { decodePerplOrder, type PerplOrderOutcome } from "@senryo/chain";
import { mainnetReadOf, type OperationRecord, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { PERPL_CHAIN } from "./market";

export function perplOrderHash(record: OperationRecord | undefined): `0x${string}` | undefined {
  const step = record?.steps.find((s) => s.action === "perplOrder" && s.outcome === "completed" && s.hash);
  return step?.hash as `0x${string}` | undefined;
}

export function usePerplFill(record: OperationRecord | undefined) {
  const env = useQueryEnv();
  const hash = perplOrderHash(record);
  const query = useQuery({
    queryKey: ["perpl", PERPL_CHAIN, "fill", hash ?? ""] as const,
    enabled: hash !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<PerplOrderOutcome> => {
      const receipt = await mainnetReadOf(env).getTransactionReceipt({ hash: hash as `0x${string}` });
      return decodePerplOrder(receipt.logs, PERPL_CHAIN);
    },
  });
  return { hash, fill: query.data, failed: query.isError, retry: () => void query.refetch() };
}
