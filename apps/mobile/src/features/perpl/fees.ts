/**
 * Network fees for a Perpl journey (B11, Mainnet pays its own fees in MON): Monad charges the gas limit, so every
 * step's budget (`GAS_LIMITS`, the most `planGas` will set) at today's max fee must be on the wallet before the slide.
 * The order is budgeted at its cap — its estimate can't run before the deposit it depends on exists.
 */
import type { ReadClient } from "@senryo/chain";
import { GAS_LIMITS, type GasAction } from "@senryo/config";
import type { Address } from "@senryo/core";
import { userFeeCache } from "@senryo/query";

/** MON (wei) the wallet is short of for `actions`; 0 when it has enough. */
export async function perplFeeShortWei(
  read: ReadClient,
  owner: Address,
  actions: readonly GasAction[],
): Promise<bigint> {
  if (actions.length === 0) return 0n;
  const [fees, monWei] = await Promise.all([
    userFeeCache(read).get(),
    read.getBalance({ address: owner, blockTag: "latest" }),
  ]);
  const need = actions.reduce((sum, action) => sum + GAS_LIMITS[action], 0n) * fees.maxFeePerGas;
  return monWei >= need ? 0n : need - monWei;
}
