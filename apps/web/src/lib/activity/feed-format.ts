/**
 * The web's pieces of the shared Activity model (`@senryo/query` activity-feed, -journal, -wallet), as on the phone:
 * its token amounts and short addresses, and the indexed rows' copy and market marks. Built once; every feed call
 * passes it.
 */
import { shortAddress } from "@senryo/core";
import type { FeedFormat } from "@senryo/query";
import { tokenAmount } from "@/lib/money/format";
import { activityFigure, activityTitle, groupOf } from "./copy";
import { indexedMarketMark } from "./market-id";

export const FEED_FORMAT: FeedFormat = {
  tokenAmount,
  shortAddress: (address) => shortAddress(address),
  activityTitle,
  activityFigure,
  groupOf,
  marketMark: indexedMarketMark,
};
