/**
 * The session allowlist per network: the dollar token (Circle USDC on mainnet, our Test USD on testnet from the
 * generated address book) and the contracts a session may approve. Never typed in by hand for testnet, so a redeploy
 * moves the scope with it (the `address-drift` invariant keeps the book honest). The market contracts join the
 * spender list with the S2 deploy (D-256).
 */
import { type ChainId, MAINNET_CHAIN_ID, MAINNET_USDC } from "@senryo/config";
import { addressBooks } from "@senryo/contracts";
import { type Address, getAddress } from "viem";

/** Address-book entries that are 6-decimal dollars valued at par. */
const DOLLAR_ENTRIES = ["TestUSD"] as const;
/** Address-book entries a session may approve (finite allowances only, D-266). */
const SPENDER_ENTRIES = ["BandReserve"] as const;

export interface ScopeTargets {
  /** Dollar tokens on this network. */
  dollars: readonly Address[];
  /** Contracts a session may approve. */
  spenders: readonly Address[];
}

function entries(chainId: ChainId, names: readonly string[]): Address[] {
  return names
    .map((n) => addressBooks[chainId]?.contracts[n]?.address)
    .filter((a): a is `0x${string}` => a !== undefined)
    .map((a) => getAddress(a));
}

const cache = new Map<ChainId, ScopeTargets>();

export function scopeTargets(chainId: ChainId): ScopeTargets {
  const hit = cache.get(chainId);
  if (hit) return hit;
  const dollars = entries(chainId, DOLLAR_ENTRIES);
  if (chainId === MAINNET_CHAIN_ID) dollars.push(getAddress(MAINNET_USDC));
  const targets: ScopeTargets = { dollars, spenders: entries(chainId, SPENDER_ENTRIES) };
  cache.set(chainId, targets);
  return targets;
}

export function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
}

export function includesAddress(list: readonly Address[], a: Address | undefined): boolean {
  return list.some((x) => sameAddress(x, a));
}
