import type { Address } from "@senryo/core";
import { ActivityDocument, activityVars } from "@senryo/indexer-client";
import { indexedItem, keys, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { FEED_FORMAT } from "./feed-format";

/** Re-read the event by id inside the current account/network scope; never trust a link's ownership. */
export function useIndexedReceipt(id: string | undefined, address: Address | undefined) {
  const env = useQueryEnv();
  return useQuery({
    queryKey: [...keys.activity(env.chainId, address ?? "0x"), "receipt", id],
    enabled: Boolean(id && address),
    queryFn: async ({ signal }) => {
      const vars = activityVars({ chainId: env.chainId, user: address ?? "0x" }, { limit: 1 });
      const rows = await env.indexer.request(
        ActivityDocument,
        {
          ...vars,
          where: { ...vars.where, id: { _eq: id } },
        },
        signal,
      );
      return rows[0] ? indexedItem(rows[0], env.chainId, address ?? "0x", FEED_FORMAT) : null;
    },
  });
}
