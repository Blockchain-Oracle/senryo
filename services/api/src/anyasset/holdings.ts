/**
 * `/v1/holdings` (B1, D6): discovery (HyperSync → Alchemy → the token list) names the candidate tokens; balances are
 * read onchain at one block for the candidates plus every listed token (so a verified holding never depends on
 * discovery); verified = on the token list by address; prices for verified tokens only (mainnet); unverified tokens
 * get a GeckoTerminal image when one exists and a `lookalike` flag when they copy a verified symbol. Zero balances are
 * dropped. One response per (chain, address) is reused for HOLDINGS_CACHE_MS.
 */
import type { Holding, Holdings } from "@senryo/api-client";
import { type Address, getAddress, type ReadClient, readTokenBalances, type TokenMetadata } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, NATIVE_TOKEN, networkOf, WMON } from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import { alchemyDiscover } from "./alchemy.ts";
import { HOLDINGS_CACHE_MS } from "./constants.ts";
import type { GeckoTerminal, TokenPrice } from "./gecko.ts";
import type { HyperSyncScanner } from "./hypersync.ts";
import type { TokenList, TokenListService } from "./token-list.ts";
import type { TokenMetadataCache } from "./token-meta.ts";
import { errorText, TtlCache } from "./upstream.ts";

const PRICE_DECIMALS = 18;
const USD6_DECIMALS = 6;
const TEN = 10n;
const CACHE_MAX = 5_000;

export interface HoldingsDeps {
  log: Logger;
  read: (chainId: ChainId) => ReadClient;
  tokenList: TokenListService;
  metadata: TokenMetadataCache;
  hypersync: HyperSyncScanner;
  gecko: GeckoTerminal;
  alchemyKey: string | undefined;
}

type DiscoveryInfo = Holdings["discovery"];

export function valueUsd6(balance: bigint, decimals: number, priceUsd18: bigint): bigint {
  return (balance * priceUsd18) / TEN ** BigInt(decimals + PRICE_DECIMALS - USD6_DECIMALS);
}

export class HoldingsService {
  private readonly cache = new TtlCache<Holdings>(CACHE_MAX);

  constructor(private readonly deps: HoldingsDeps) {}

  get(chainId: ChainId, owner: Address): Promise<Holdings> {
    return this.cache.load(`${chainId}:${owner.toLowerCase()}`, HOLDINGS_CACHE_MS, () => this.build(chainId, owner));
  }

  private async discover(
    chainId: ChainId,
    owner: Address,
  ): Promise<{ tokens: Address[]; info: DiscoveryInfo; prices: Map<string, TokenPrice> }> {
    const { hypersync, alchemyKey, log } = this.deps;
    let note: string | null = null;
    if (hypersync.configured) {
      try {
        const d = await hypersync.discover(chainId, owner);
        const info = {
          source: "hypersync" as const,
          complete: d.complete,
          scannedToBlock: d.scannedToBlock,
          note: d.note,
        };
        return { tokens: d.tokens, info, prices: new Map() };
      } catch (error) {
        note = `HyperSync: ${errorText(error)}`;
        log.warn({ chainId, err: errorText(error) }, "holdings: hypersync discovery failed");
      }
    } else note = "HyperSync token not configured";
    if (alchemyKey) {
      try {
        const a = await alchemyDiscover(alchemyKey, chainId, owner);
        return {
          tokens: a.tokens,
          info: { source: "alchemy", complete: true, scannedToBlock: null, note },
          prices: a.prices,
        };
      } catch (error) {
        note = `${note}; Alchemy: ${errorText(error)}`;
        log.warn({ chainId, err: errorText(error) }, "holdings: alchemy discovery failed");
      }
    }
    return {
      tokens: [],
      info: { source: "tokenlist", complete: false, scannedToBlock: null, note },
      prices: new Map(),
    };
  }

  private async build(chainId: ChainId, owner: Address): Promise<Holdings> {
    const { read: readOf, tokenList, gecko } = this.deps;
    const read = readOf(chainId);
    const [list, discovery] = await Promise.all([tokenList.get(chainId), this.discover(chainId, owner)]);
    const candidates = new Map<string, Address>([[NATIVE_TOKEN, NATIVE_TOKEN]]);
    for (const t of list.tokens) candidates.set(t.address.toLowerCase(), t.address);
    for (const t of discovery.tokens) candidates.set(t.toLowerCase(), t);
    const addresses = [...candidates.values()];
    const blockNumber = await read.getBlockNumber();
    const balances = await readTokenBalances(read, owner, addresses, blockNumber);
    const held = addresses.flatMap((address, i) => {
      const balance = balances[i];
      return balance !== undefined && balance > 0n ? [{ address, balance }] : [];
    });
    const unlisted = held.filter((h) => !isNative(h.address) && !list.byAddress.has(h.address.toLowerCase()));
    const metas = await this.deps.metadata.of(
      read,
      chainId,
      unlisted.map((h) => h.address),
    );
    const mainnet = chainId === MAINNET_CHAIN_ID;
    const verifiedHeld = held.filter((h) => isNative(h.address) || list.byAddress.has(h.address.toLowerCase()));
    const priceKeys = verifiedHeld.map((h) => (isNative(h.address) ? WMON[chainId] : h.address).toLowerCase());
    const [prices, images] = await Promise.all([
      mainnet ? gecko.priceMap(priceKeys.filter((k) => !discovery.prices.has(k))) : Promise.resolve(new Map()),
      mainnet ? gecko.imageMap(unlisted.map((h) => h.address)) : Promise.resolve(new Map<string, string | null>()),
    ]);
    for (const [k, v] of discovery.prices) prices.set(k, v);

    const tokens: Holding[] = [];
    for (const h of held) {
      const holding = this.holdingOf(chainId, h, list, metas, prices, images);
      if (holding) tokens.push(holding);
    }
    tokens.sort(order);
    const verifiedTokens = tokens.filter((t) => t.verified);
    return {
      chainId,
      address: getAddress(owner),
      at: new Date().toISOString(),
      blockNumber,
      discovery: discovery.info,
      tokens,
      totalUsd6: verifiedTokens.reduce((sum, t) => sum + (t.valueUsd6 ?? 0n), 0n),
      partial: mainnet && verifiedTokens.some((t) => t.priceUsd18 === null),
      pricesAvailable: mainnet,
    };
  }

  private holdingOf(
    chainId: ChainId,
    h: { address: Address; balance: bigint },
    list: TokenList,
    metas: Map<string, TokenMetadata | null>,
    prices: Map<string, TokenPrice>,
    images: Map<string, string | null>,
  ): Holding | undefined {
    const lower = h.address.toLowerCase();
    if (isNative(h.address)) {
      const price = prices.get(WMON[chainId].toLowerCase());
      const { symbol, name, decimals } = networkOf(chainId).nativeCurrency;
      const listed = list.byAddress.get(NATIVE_TOKEN);
      return priced(
        { address: NATIVE_TOKEN, native: true, symbol, name, decimals, balance: h.balance, verified: true },
        { lookalike: false, mark: `native:${chainId}:${symbol}`, logoUrl: listed?.logoURI ?? null },
        price,
      );
    }
    const listed = list.byAddress.get(lower);
    if (listed) {
      return priced(
        { ...pick(listed), address: h.address, native: false, balance: h.balance, verified: true },
        { lookalike: false, mark: `token:${chainId}:${lower}`, logoUrl: listed.logoURI },
        prices.get(lower),
      );
    }
    const meta = metas.get(lower);
    if (!meta) return undefined;
    return priced(
      { ...meta, address: h.address, native: false, balance: h.balance, verified: false },
      {
        lookalike: list.symbols.has(meta.symbol.toLowerCase()),
        mark: `token:${chainId}:${lower}`,
        logoUrl: images.get(lower) ?? null,
      },
      undefined,
    );
  }
}

const isNative = (address: string) => address.toLowerCase() === NATIVE_TOKEN;
const pick = (t: { symbol: string; name: string; decimals: number }) => ({
  symbol: t.symbol,
  name: t.name,
  decimals: t.decimals,
});

function priced(
  base: Pick<Holding, "address" | "native" | "symbol" | "name" | "decimals" | "balance" | "verified">,
  look: Pick<Holding, "lookalike" | "mark" | "logoUrl">,
  price: TokenPrice | undefined,
): Holding {
  return {
    ...base,
    ...look,
    priceUsd18: price?.priceUsd18 ?? null,
    valueUsd6: price ? valueUsd6(base.balance, base.decimals, price.priceUsd18) : null,
    change24hBps: price?.change24hBps ?? null,
    priceSource: price?.source ?? null,
  };
}

/** Verified by value (priced first), then unverified by symbol. */
function order(a: Holding, b: Holding): number {
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  if (!a.verified) return a.symbol.localeCompare(b.symbol);
  const av = a.valueUsd6 ?? -1n;
  const bv = b.valueUsd6 ?? -1n;
  if (av !== bv) return av > bv ? -1 : 1;
  return a.symbol.localeCompare(b.symbol);
}
