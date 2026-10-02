import { type IndexerClient, LpRequestsDocument } from "@senryo/indexer-client";

import { operationsFor } from "./operations.ts";

const PAGE_SIZE = 100;
/** Every own indexed request, across pages. The chain subsequently verifies ownership and unclaimed shares. */
export async function ownLpRequests(indexer: IndexerClient, chainId: number, address: string, block: bigint) {
  const ids = operationsFor(chainId, address).flatMap((record) =>
    record.steps.flatMap((step) =>
      step.outcome === "completed" && step.blockNumber && BigInt(step.blockNumber) <= block
        ? (step.facts ?? []).flatMap((fact) =>
            fact.event === "RedeemRequested" && fact.values.requestId ? [BigInt(fact.values.requestId)] : [],
          )
        : [],
    ),
  );
  let complete = true;
  let indexedBlock: bigint | undefined;
  let ready = true;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await indexer
      .request(LpRequestsDocument, {
        chainId,
        where: { chainId: { _eq: chainId }, owner: { _eq: address.toLowerCase() } },
        offset,
        limit: PAGE_SIZE,
      })
      .catch(() => undefined);
    if (!page) return { ids: [...new Set(ids)], complete: false };
    ready &&= page.meta?.isReady === true;
    const progress = page.meta ? BigInt(page.meta.progressBlock) : undefined;
    if (progress !== undefined)
      indexedBlock = indexedBlock === undefined || progress < indexedBlock ? progress : indexedBlock;
    complete &&= ready && progress !== undefined && progress >= block;
    for (const row of page.requests) {
      const id = row.id.split(":").at(-1);
      if (!id || !/^\d+$/.test(id)) throw new Error("Unrecognised pool request id");
      ids.push(BigInt(id));
    }
    if (page.requests.length < PAGE_SIZE) return { ids, complete, indexedBlock: ready ? indexedBlock : undefined };
  }
}
