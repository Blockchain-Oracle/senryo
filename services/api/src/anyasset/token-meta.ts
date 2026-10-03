/**
 * ERC-20 metadata (decimals, symbol, name) for tokens that aren't on the token list, read onchain in one multicall and
 * cached a day per token — misses too, so a contract that isn't a token is asked once. Shared by holdings (B1) and
 * wallet activity (D8), so a token named in one is free in the other.
 */
import { type Address, type ReadClient, readTokenMetadata, type TokenMetadata } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { METADATA_TTL_MS } from "./constants.ts";
import { TtlCache } from "./upstream.ts";

const META_CACHE_MAX = 50_000;

export class TokenMetadataCache {
  private readonly cache = new TtlCache<TokenMetadata | null>(META_CACHE_MAX);

  /** Lower-case address → metadata, or null when the contract doesn't answer as an ERC-20. */
  async of(read: ReadClient, chainId: ChainId, tokens: readonly Address[]): Promise<Map<string, TokenMetadata | null>> {
    const key = (t: Address) => `${chainId}:${t.toLowerCase()}`;
    const unknown = tokens.filter((t) => this.cache.get(key(t)) === undefined);
    if (unknown.length > 0) {
      const metas = await readTokenMetadata(read, unknown);
      for (const [i, t] of unknown.entries()) this.cache.set(key(t), metas[i] ?? null, METADATA_TTL_MS);
    }
    return new Map(tokens.map((t) => [t.toLowerCase(), this.cache.get(key(t)) ?? null]));
  }
}
