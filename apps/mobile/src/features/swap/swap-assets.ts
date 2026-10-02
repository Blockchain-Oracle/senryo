/**
 * What a swap can receive (B6, B14): verified tokens only — what the account already holds, Monad's token list, and
 * native MON — never an unverified token. Held rows keep their balances; listed-only rows have none.
 */
import { type ChainId, NATIVE_TOKEN } from "@senryo/config";
import { ids } from "@senryo/identity";
import type { MoneyAsset } from "~/features/money/assets";

const MON_DECIMALS = 18;

/** Native MON as a money row (balance when known) — the receive side's own entry and the pay side's fallback. */
export function nativeMon(chainId: ChainId, monWei: bigint | undefined): MoneyAsset {
  const wallet = monWei ?? 0n;
  return {
    key: NATIVE_TOKEN.toLowerCase(),
    address: NATIVE_TOKEN,
    native: true,
    symbol: "MON",
    name: "Monad",
    decimals: MON_DECIMALS,
    mark: ids.native(chainId, "MON"),
    logoUrl: null,
    verified: true,
    lookalike: false,
    priceUsd18: null,
    change24hBps: null,
    wallet,
    trading: 0n,
    tradingFree: 0n,
    total: wallet,
    valueUsd6: null,
    collateral: undefined,
    bridge: undefined,
  };
}

/** Held verified assets first (by value), then native MON and every listed token, each once. */
export function receiveCandidates(
  chainId: ChainId,
  held: readonly MoneyAsset[],
  listed: readonly MoneyAsset[],
): MoneyAsset[] {
  const out = new Map<string, MoneyAsset>();
  for (const a of held) if (a.verified) out.set(a.key, a);
  const mon = nativeMon(chainId, undefined);
  if (!out.has(mon.key)) out.set(mon.key, mon);
  for (const a of listed) if (!out.has(a.key)) out.set(a.key, a);
  return [...out.values()];
}
