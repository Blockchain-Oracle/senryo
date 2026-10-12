import { type SignedSigmaMark, signSigmaMark } from "@senryo/chain";
import { feedIdOf, type MarketSpec, sigmaE8Of } from "@senryo/config";
import { markMinuteOf } from "@senryo/core";
import { marketOpenAt, sigmaMarkFor } from "@senryo/service-common";
import type { KeeperContext } from "./context.ts";

/** The stored σ mark a fill of `market` at `target` carries (computed first if missing), signed by the keeper. */
export async function fillMark(ctx: KeeperContext, market: MarketSpec, target: number): Promise<SignedSigmaMark> {
  const feedId = feedIdOf(market);
  const m = await sigmaMarkFor(ctx.db, feedId, markMinuteOf(target), sigmaE8Of(market), marketOpenAt(market));
  return signSigmaMark(ctx.signer, ctx.chainId, { feedId, minute: m.minute, fastE8: m.fastE8, slowE8: m.slowE8 });
}
