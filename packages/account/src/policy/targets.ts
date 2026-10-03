/**
 * The session allowlist per network, read from the generated address book (`@senryo/contracts`) — never typed in by
 * hand, so a redeploy moves the scope with it (the `address-drift` invariant keeps the book honest).
 */
import { type ChainId, PERPL_COLLATERAL, PERPL_EXCHANGE, PERPL_MARKET_SCALES } from "@senryo/config";
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
  /** Practice AUSD ↔ USDC at par (D-252, testnet only): its `swap` is a swap, and it may be approved. */
  practiceSwap: Address | undefined;
  stables: readonly Address[];
  faucets: readonly Address[];
  /**
   * Spenders a session may approve: the core, the LP vault, Perpl's Exchange (D1) and the practice swap (it only ever
   * pulls from its own caller).
   */
  spenders: readonly Address[];
  /** Perpl's Exchange and its collateral (AUSD) on this network, from `@senryo/config` (not our address book). */
  perplExchange: Address | undefined;
  perplCollateral: Address | undefined;
  /** Price/lot decimals per Perpl market: an order is valued from calldata with these; an unlisted market is unknown. */
  perplScales: Readonly<Record<number, { priceDecimals: number; lotDecimals: number }>>;
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
  const perplExchange = PERPL_EXCHANGE[chainId] ? getAddress(PERPL_EXCHANGE[chainId]) : undefined;
  const practiceSwap = entry(chainId, "PracticeSwap");
  const targets: ScopeTargets = {
    core,
    lpVault,
    starterDrip: entry(chainId, "StarterDrip"),
    intentRouter: entry(chainId, "IntentRouter"),
    practiceSwap,
    stables: entries(chainId, STABLE_ENTRIES),
    faucets: entries(chainId, FAUCET_ENTRIES),
    spenders: [core, lpVault, perplExchange, practiceSwap].filter((a): a is Address => a !== undefined),
    perplExchange,
    perplCollateral: PERPL_COLLATERAL[chainId] ? getAddress(PERPL_COLLATERAL[chainId]) : undefined,
    perplScales: PERPL_MARKET_SCALES[chainId] ?? {},
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
