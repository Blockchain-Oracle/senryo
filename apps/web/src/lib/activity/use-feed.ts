"use client";

/**
 * The Activity feed for one tab (B12): the indexer's events for this tab (a page at a time) merged with this phone's
 * journal operations of the same group, re-read whenever an operation advances. A market's own history
 * (`marketId`) is indexer-only. When the indexer can't be reached, the journal rows still show with the failure.
 */
import type { Address, Diagnosis } from "@senryo/core";
import { operationsFor, subscribeOperations, useQueryEnv } from "@senryo/query";
import { useEffect, useMemo, useState } from "react";
import { FILTER_KINDS } from "./copy";
import { type FeedGroup, type FeedItem, indexedItem, journalItem, mergeFeed } from "./feed";
import { useActivity } from "./use-activity";

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
  const reading = activity.reading;
  const indexed =
    reading.status === "fresh" || reading.status === "stale"
      ? reading.value.map((row) => indexedItem(row, env.chainId, address ?? ""))
      : undefined;
  const items =
    indexed !== undefined
      ? mergeFeed(indexed, journal, !activity.hasMore)
      : reading.status === "failed" || journal.length > 0
        ? mergeFeed([], journal, true)
        : undefined;
  return {
    items,
    error: reading.status === "failed" ? reading.error : undefined,
    stale: reading.status === "stale",
    hasMore: activity.hasMore,
    loadingMore: activity.loadingMore,
    loadMore: activity.loadMore,
    refetch: activity.refetch,
  };
}
