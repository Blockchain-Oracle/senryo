/**
 * The Activity feed for one tab (B12): the indexer's events for this tab (a page at a time) merged with this phone's
 * journal operations of the same group and — on All and Money — the wallet's own movements (D8), re-read whenever an
 * operation advances. A market's own history (`marketId`) is indexer-only. When the indexer can't be reached, the
 * journal and wallet rows still show with the failure; when the wallet source can't be reached, the feed goes on
 * without it. Wallet rows are silent: the moment and the sound belong to the operation or the arrival, never a row.
 */
import type { Address, Diagnosis } from "@senryo/core";
import { operationsFor, subscribeOperations, useQueryEnv } from "@senryo/query";
import { useEffect, useMemo, useState } from "react";
import { useHiddenTokens } from "~/features/money/hidden";
import { FILTER_KINDS } from "~/features/portfolio/activity-copy";
import { useActivity } from "~/features/portfolio/useActivity";
import { type FeedGroup, type FeedItem, indexedItem, journalItem, mergeFeed } from "./feed";
import { useWalletActivity } from "./useWalletActivity";
import { walletItem, walletShown } from "./wallet-item";

export type FeedFilter = "all" | FeedGroup;

export interface Feed {
  /** Undefined until the first indexed page (or the indexer's failure) is known. */
  items: FeedItem[] | undefined;
  error: Diagnosis | undefined;
  stale: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  refetch: () => Promise<unknown>;
}

export function useFeed(address: Address | undefined, filter: FeedFilter, marketId?: string): Feed {
  const env = useQueryEnv();
  const activity = useActivity(address, filter === "all" ? undefined : FILTER_KINDS[filter], marketId);
  const walletOn = !marketId && (filter === "all" || filter === "money");
  const wallet = useWalletActivity(address, walletOn);
  const hidden = useHiddenTokens(env.chainId, address);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeOperations(() => setRevision((r) => r + 1)), []);
  // `revision` re-reads the journal when an operation advances (subscribeOperations notifies after each write).
  const journal = useMemo(() => {
    if (!address || marketId) return [];
    return operationsFor(env.chainId, address)
      .map((record) => journalItem(record, address))
      .filter((item): item is FeedItem => item !== undefined)
      .filter((item) => filter === "all" || item.group === filter);
  }, [address, env.chainId, filter, marketId, revision]);
  const moves = {
    items:
      walletOn && wallet.items
        ? wallet.items.filter((w) => walletShown(w, hidden.has)).map((w) => walletItem(w, env.chainId))
        : [],
    // Not loaded yet, or unreachable: it holds nothing back (its rows join when they come).
    complete: !walletOn || wallet.items === undefined || !wallet.hasMore,
  };
  const reading = activity.reading;
  const indexed =
    reading.status === "fresh" || reading.status === "stale"
      ? reading.value.map((row) => indexedItem(row, env.chainId, address ?? ""))
      : undefined;
  const items =
    indexed !== undefined
      ? mergeFeed({ items: indexed, complete: !activity.hasMore }, journal, moves)
      : reading.status === "failed" || journal.length > 0
        ? mergeFeed({ items: [], complete: true }, journal, moves)
        : undefined;
  return {
    items,
    error: reading.status === "failed" ? reading.error : undefined,
    stale: reading.status === "stale",
    hasMore: activity.hasMore || (walletOn && wallet.hasMore),
    loadingMore: activity.loadingMore || wallet.loadingMore,
    loadMore: () => {
      if (activity.hasMore) activity.loadMore();
      if (walletOn && wallet.hasMore) wallet.loadMore();
    },
    refetch: () => Promise.all([activity.refetch(), walletOn ? wallet.refetch() : undefined]),
  };
}
