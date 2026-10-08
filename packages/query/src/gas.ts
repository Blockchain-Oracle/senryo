/**
 * The user-send fee quote (S8.16b, D-171): Monad consensus checks the sender's balance against the gas LIMIT × the max
 * fee it signs, so user sends sign with a tighter base-fee multiplier than the services. After the pivot every market
 * action is relayed (D-266), so only the wallet's own sends (and recovery) still sign through this.
 */
import { FEE_REFRESH_MS, FeeCache, type ReadClient } from "@senryo/chain";
import { USER_MAX_FEE_BASE_MULTIPLIER_BPS } from "@senryo/config";

const feeCaches = new WeakMap<ReadClient, FeeCache>();

/** One per read client. The app's sender MUST use this same cache so a budget and the signed max fee never disagree. */
export function userFeeCache(read: ReadClient): FeeCache {
  let cache = feeCaches.get(read);
  if (!cache) {
    cache = new FeeCache(read, FEE_REFRESH_MS, USER_MAX_FEE_BASE_MULTIPLIER_BPS);
    feeCaches.set(read, cache);
  }
  return cache;
}
