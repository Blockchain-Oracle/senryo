import { basketMembers, feedIdOf, type MarketSpec } from "@senryo/config";
import { basketPointsE8 } from "@senryo/core";
import { type PriceUpdate, toE8 } from "./ring.ts";

/** A basket's value is quoted in points × 1e8 (D-286). */
const PRINT_EXPO = -8;

/**
 * A basket's value from one update per member, in member order (`BasketPrintVerifier`'s maths, D-286): the index and
 * its spread in points, the newest member times, and every member's update bytes in member order. Undefined while any
 * member has none.
 */
export function composeBasket(basket: MarketSpec, prints: readonly PriceUpdate[]): PriceUpdate | undefined {
  const members = basketMembers(basket);
  const terms = (pick: (p: PriceUpdate) => bigint) =>
    members.map(({ member }, i) => {
      const p = prints[i];
      return { weightBps: member.weightBps, baseE8: member.baseE8, valueE8: p ? toE8(pick(p), p.expo) : undefined };
    });
  const price = basketPointsE8(terms((p) => p.price));
  const conf = basketPointsE8(terms((p) => p.conf));
  if (price === null || conf === null) return undefined;
  return {
    feedId: feedIdOf(basket),
    publishTime: Math.max(...prints.map((p) => p.publishTime)),
    prevPublishTime: Math.max(...prints.map((p) => p.prevPublishTime)),
    price,
    conf,
    expo: PRINT_EXPO,
    updates: prints.flatMap((p) => p.updates),
    receivedAt: Math.max(...prints.map((p) => p.receivedAt)),
  };
}
