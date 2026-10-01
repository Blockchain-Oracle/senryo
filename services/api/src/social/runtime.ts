import type { ChainId } from "@senryo/config";
import type { SocialIndexer } from "./indexer-source.ts";
import type { LeaderboardService } from "./leaderboard.ts";
import type { SocialContext } from "./shared.ts";

/**
 * The social layer's long-lived services (S12b.4–8), built once in `main.ts` (and by the social check with a mocked
 * indexer). One api instance serves all traffic (D-121), so the notifier and the snapshots are process-local.
 */
export interface SocialServices {
  indexer: SocialIndexer;
  leaderboard: LeaderboardService;
  notifier: FeedNotifier;
  /** Networks this api serves (reporter weights read deposits on each). */
  chainIds: readonly ChainId[];
  /** Operator bearer secret for the review queue; undefined → admin routes answer 503. */
  adminSecret: string | undefined;
  /** The visible contact point (App Store 1.2). */
  contact: { email: string; url: string | null };
}

export type SocialRuntime = SocialContext & { social: SocialServices };

export type FeedListener = (chainId: ChainId, latestId: bigint) => void;

/** "New activity" fan-out: the poller and new theses emit; the WS hub conflates and pushes `feed:{chainId}`. */
export class FeedNotifier {
  private readonly listeners = new Set<FeedListener>();

  on(listener: FeedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(chainId: ChainId, latestId: bigint): void {
    for (const listener of this.listeners) listener(chainId, latestId);
  }
}
