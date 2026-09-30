/**
 * The session allowlist per network, read from the generated address book (`@senryo/contracts`) — never typed in by
 * hand, so a redeploy moves the scope with it (the `address-drift` invariant keeps the book honest).
 */
import type { ChainId } from "@senryo/config";
import { addressBooks } from "@senryo/contracts";
import { type Address, getAddress } from "viem";

/** Address-book entries that are 6-decimal stables valued at par (testnet mocks now; mainnet AUSD/USDC from S8). */
const STABLE_ENTRIES = ["MockAUSD", "MockUSDC", "AUSD", "USDC"] as const;
/** Testnet mocks expose a public `faucet()` (practice funds, no value). */
const FAUCET_ENTRIES = ["MockAUSD", "MockUSDC"] as const;

export interface ScopeTargets {
  core: Address | undefined;
  lpVault: Address | undefined;
  starterDrip: Address | undefined;
  intentRouter: Address | undefined;
  stables: readonly Address[];
  faucets: readonly Address[];
  /** Spenders a session may approve (the core and the LP vault; Perpl's exchange joins in S7). */
  spenders: readonly Address[];
}

function entry(chainId: ChainId, name: string): Address | undefined {
  const found = addressBooks[chainId]?.contracts[name];
  return found ? getAddress(found.address) : undefined;
}

function entries(chainId: ChainId, names: readonly string[]): Address[] {
  return names.map((n) => entry(chainId, n)).filter((a): a is Address => a !== undefined);
}

const cache = new Map<ChainId, ScopeTargets>();

export function scopeTargets(chainId: ChainId): ScopeTargets {
  const hit = cache.get(chainId);
  if (hit) return hit;
  const core = entry(chainId, "SenryoCore");
  const lpVault = entry(chainId, "LpVault");
  const targets: ScopeTargets = {
    core,
    lpVault,
    starterDrip: entry(chainId, "StarterDrip"),
    intentRouter: entry(chainId, "IntentRouter"),
    stables: entries(chainId, STABLE_ENTRIES),
    faucets: entries(chainId, FAUCET_ENTRIES),
    spenders: [core, lpVault].filter((a): a is Address => a !== undefined),
  };
  cache.set(chainId, targets);
  return targets;
}

export function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
}

export function includesAddress(list: readonly Address[], a: Address | undefined): boolean {
  return list.some((x) => sameAddress(x, a));
}
