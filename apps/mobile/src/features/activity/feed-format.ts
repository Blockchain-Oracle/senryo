/**
 * The phone's pieces of the shared Activity model (`@senryo/query` activity-feed, -journal, -wallet): its token amounts
 * and short addresses, and the indexed rows' copy and market marks. Built once; every feed call passes it.
 */
import type { FeedFormat } from "@senryo/query";
import { activityFigure, activityTitle, groupOf } from "~/features/portfolio/activity-copy";
import { indexedMarketMark } from "~/features/portfolio/market-id";
import { tokenAmount } from "~/features/tokens/format";
import { shortAddress } from "~/lib/format";

export const FEED_FORMAT: FeedFormat = {
  tokenAmount,
  shortAddress: (address) => shortAddress(address),
  activityTitle,
  activityFigure,
  groupOf,
  marketMark: indexedMarketMark,
};
