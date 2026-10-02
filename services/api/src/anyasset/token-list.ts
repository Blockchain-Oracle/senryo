/**
 * Monad's token list (github.com/monad-crypto/token-list) as the verified set (B1): an address on it is verified, every
 * other address is not — symbols are never trusted. Fetched from `main` and refreshed every few hours; a failed refresh
 * keeps the last good copy, and on mainnet the generated spot tokens (pinned list commit) seed it before the first
 * fetch. Practice adds our own mock AUSD/USDC (the Practice assets) from the address book.
 */
import { type Address, addressOf, getAddress, isDeployed } from "@senryo/chain";
import {
  type ChainId,
  MAINNET_CHAIN_ID,
  MONAD_TOKEN_LIST,
  SPOT_TOKENS,
  TESTNET_CHAIN_ID,
  TOKEN_LIST_URL,
} from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import { z } from "zod";
import { TOKEN_LIST_TIMEOUT_MS, TOKEN_LIST_TTL_MS } from "./constants.ts";
import { errorText, fetchJson, TtlCache } from "./upstream.ts";

export interface ListedToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
}

export interface TokenList {
  tokens: readonly ListedToken[];
  byAddress: ReadonlyMap<string, ListedToken>;
  /** Lower-case symbols of verified tokens (lookalike check), MON included. */
  symbols: ReadonlySet<string>;
  /** "list" = fetched now or recently; "seed" = the fallback before any fetch succeeded. */
  origin: "list" | "seed";
}

const MAX_DECIMALS = 36;
const listSchema = z.object({
  tokens: z.array(
    z.object({
      chainId: z.number(),
      address: z.string(),
      symbol: z.string(),
      name: z.string(),
      decimals: z.number().int().min(0).max(MAX_DECIMALS),
      logoURI: z.string().optional(),
    }),
  ),
});

const PRACTICE_DECIMALS = 6;

function build(tokens: readonly ListedToken[], origin: TokenList["origin"]): TokenList {
  const byAddress = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));
  const symbols = new Set(tokens.map((t) => t.symbol.toLowerCase()));
  symbols.add("mon");
  return { tokens: [...byAddress.values()], byAddress, symbols, origin };
}

/** Before any fetch: mainnet = the generated spot tokens; Practice = none from the list. */
function seed(chainId: ChainId): ListedToken[] {
  if (chainId !== MAINNET_CHAIN_ID) return [];
  return SPOT_TOKENS.map((t) => ({
    address: getAddress(t.address),
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: `${MONAD_TOKEN_LIST.raw}/${MONAD_TOKEN_LIST.commit}/mainnet/${t.list.dir}/${t.list.logo}`,
  }));
}

/** Practice's own assets (mock AUSD/USDC), verified on 10143 alongside the testnet list. */
function practiceTokens(chainId: ChainId): ListedToken[] {
  if (chainId !== TESTNET_CHAIN_ID) return [];
  const out: ListedToken[] = [];
  for (const [name, symbol] of [
    ["MockAUSD", "AUSD"],
    ["MockUSDC", "USDC"],
  ] as const) {
    if (!isDeployed(chainId, name)) continue;
    out.push({
      address: getAddress(addressOf(chainId, name)),
      symbol,
      name: `Practice ${symbol}`,
      decimals: PRACTICE_DECIMALS,
      logoURI: null,
    });
  }
  return out;
}

export class TokenListService {
  private readonly cache = new TtlCache<TokenList>(2);

  constructor(private readonly log: Logger) {}

  async get(chainId: ChainId): Promise<TokenList> {
    const key = String(chainId);
    try {
      return await this.cache.load(key, TOKEN_LIST_TTL_MS, () => this.fetchList(chainId));
    } catch (error) {
      const stale = this.cache.peek(key);
      this.log.warn({ chainId, err: errorText(error), stale: Boolean(stale) }, "token list refresh failed");
      if (stale) return stale.value;
      return build([...seed(chainId), ...practiceTokens(chainId)], "seed");
    }
  }

  private async fetchList(chainId: ChainId): Promise<TokenList> {
    const res = await fetchJson("token-list", TOKEN_LIST_URL[chainId], { timeoutMs: TOKEN_LIST_TIMEOUT_MS });
    const parsed = listSchema.parse(res?.json);
    const listed = parsed.tokens
      .filter((t) => t.chainId === chainId && /^0x[0-9a-fA-F]{40}$/.test(t.address))
      .map((t) => ({
        address: getAddress(t.address),
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI ?? null,
      }));
    return build([...listed, ...practiceTokens(chainId)], "list");
  }
}
