import type { ReadClient } from "./clients.ts";
/** All contract/native balance reads in one valuation resolve against the same finalized block. */
export function pinRead(read: ReadClient, blockNumber: bigint): ReadClient {
  const pinned = new Set(["readContract", "multicall", "getBalance"]);
  return new Proxy(read, {
    get(target, property, receiver) {
      const method: unknown = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !pinned.has(property) || typeof method !== "function") return method;
      return (parameters: Record<string, unknown>) => {
        const { blockTag: _tag, ...rest } = parameters;
        return Reflect.apply(method, target, [{ ...rest, blockNumber }]);
      };
    },
  });
}
