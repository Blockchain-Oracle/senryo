/**
 * The Social feed (Fomo F15, F4): Global leads with labelled outside spot activity, then public Senryo trades and
 * theses on the active network. Following contains only accounts you follow. Every state is
 * designed and short: skeleton rows of the row's own shape, an empty line that differs per audience with the one way
 * to fill it, a failure with its reason and Retry, a stale stamp, and "Show more" at the end of a page. Practice and
 * Mainnet are separate feeds.
 */
import type { FeedScope } from "@senryo/api-client";
import { socialKeys, useFeed, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ErrorState, Skeleton, StaleStamp } from "~/components/kit/states";
import { TopTrades } from "~/features/home/TopTrades";
import { ExternalMarketActivity } from "~/features/markets/ExternalMarketActivity";
import { ROUTES } from "~/lib/constants/routes";
import { RADIUS, SIZE, SPACE, useTheme } from "~/theme";
import { FeedRow } from "./FeedRow";
import { QuietLine } from "./Quiet";
import { useSessionGate } from "./useSocialAccount";

export function Feed({ scope, onFindPeople }: { scope: FeedScope; onFindPeople: () => void }) {
  if (scope === "friends") return <FollowingFeed onFindPeople={onFindPeople} />;
  return (
    <View style={styles.list}>
      <ExternalMarketActivity />
      <FeedList scope="global" pinned={<TopTrades />} empty={<QuietLine text="No public Senryo trades yet" />} />
    </View>
  );
}

/** Following needs to know who is asking: the gate says so in the feed's own place, never with a prompt on arrival. */
function FollowingFeed({ onFindPeople }: { onFindPeople: () => void }) {
  const gate = useSessionGate();
  switch (gate.status) {
    case "guest":
      return (
        <QuietLine
          text="Follow traders"
          action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      );
    case "locked":
      return <QuietLine text="Unlock to see Following" action={{ label: "Unlock", onPress: gate.open }} />;
    case "pending":
      return <FeedSkeleton />;
    case "failed":
      return <QuietLine text="Couldn’t confirm it’s you" action={{ label: "Try again", onPress: gate.open }} />;
    case "ready":
      return (
        <FeedList
          scope="friends"
          onRetry={gate.open}
          empty={<QuietLine text="Follow traders" action={{ label: "Find people", onPress: onFindPeople }} />}
        />
      );
  }
}

function FeedList({
  scope,
  empty,
  pinned,
  onRetry,
}: {
  scope: FeedScope;
  empty: ReactNode;
  /** What leads the list when it has something to show (Global's Top Trades strip). */
  pinned?: ReactNode;
  /** Runs before a retry (Following re-checks the session, which is what usually failed). */
  onRetry?: () => void;
}) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const feed = useFeed(scope);
  const { reading } = feed;
  if (reading.status === "unknown") return <FeedSkeleton />;
  if (reading.status === "failed") {
    return (
      <ErrorState
        diagnosis={reading.error}
        retry={() => {
          onRetry?.();
          void client.invalidateQueries({ queryKey: socialKeys.feed(env.chainId, scope, undefined) });
        }}
      />
    );
  }
  const items = reading.value;
  return (
    <View style={styles.list}>
      {reading.status === "stale" ? (
        <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
      ) : null}
      {pinned}
      {items.length === 0 ? (
        empty
      ) : (
        <View>
          {items.map((item, i) => (
            <FeedRow key={item.id} item={item} index={i} />
          ))}
        </View>
      )}
      {feed.hasMore ? (
        <Button
          label="Show more"
          variant="ghost"
          size="sm"
          block={false}
          loading={feed.loadingMore}
          onPress={feed.loadMore}
          style={styles.center}
        />
      ) : null}
    </View>
  );
}

/** Four rows fill a phone's first screen of feed. */
const SKELETON_ROWS = ["a", "b", "c", "d"] as const;
/** Skeleton line widths: name and tag, the position chip, then two lines of text. */
const LINE_WIDTHS = ["42%", "58%", "92%", "70%"] as const;

/** Rows of the feed's own shape while the first page loads. */
export function FeedSkeleton({ rows = SKELETON_ROWS.length }: { rows?: number }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading the feed" accessibilityState={{ busy: true }}>
      {SKELETON_ROWS.slice(0, rows).map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View style={[styles.disc, { backgroundColor: color.skeleton }]} />
          <View style={styles.lines}>
            {LINE_WIDTHS.map((width) => (
              <Skeleton key={width} width={width} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.lg },
  center: { alignSelf: "center" },
  skeletonRow: { flexDirection: "row", gap: SPACE.md, paddingVertical: SPACE.md },
  disc: { width: SIZE.avatarMd, height: SIZE.avatarMd, borderRadius: RADIUS.pill },
  lines: { flex: 1, gap: SPACE.sm },
});
