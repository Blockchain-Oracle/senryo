/**
 * The Social feed (Fomo F15, C27; direction §9): Global is every public trade and thesis on the active network,
 * Friends is the same from the accounts you follow. Rows sit bare on the page. Every state is designed: skeleton rows
 * of the row's own shape, an empty line that differs per audience (Friends offers the one way to fill it), a failure
 * with a retry, and "Show more" at the end of a page. Practice and Mainnet are separate feeds.
 */
import type { FeedScope } from "@senryo/api-client";
import { socialKeys, useFeed, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ErrorState, Skeleton, StaleStamp } from "~/components/kit/states";
import { ROUTES } from "~/lib/constants/routes";
import { RADIUS, SIZE, SPACE, useTheme } from "~/theme";
import { FeedRow } from "./FeedRow";
import { QuietLine } from "./Quiet";
import { TopTrades } from "./TopTrades";
import { useSessionGate } from "./useSocialAccount";

export function Feed({ scope, onFindPeople }: { scope: FeedScope; onFindPeople: () => void }) {
  if (scope === "friends") return <FriendsFeed onFindPeople={onFindPeople} />;
  return (
    <FeedList scope="global" pinned={<TopTrades />} empty={<QuietLine text="No public trades yet on this network" />} />
  );
}

/** Friends needs to know who is asking: the gate says so in the feed's own place, never with a prompt on arrival. */
function FriendsFeed({ onFindPeople }: { onFindPeople: () => void }) {
  const gate = useSessionGate();
  switch (gate.status) {
    case "guest":
      return (
        <QuietLine
          text="Follow traders to see what they do"
          action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
        />
      );
    case "locked":
      return (
        <QuietLine
          text="Unlock to see what the traders you follow do"
          action={{ label: "Unlock", onPress: gate.open }}
        />
      );
    case "pending":
      return <FeedSkeleton />;
    case "failed":
      return (
        <QuietLine
          text="Couldn’t confirm it’s you, so your friends’ feed stayed closed"
          action={{ label: "Try again", onPress: gate.open }}
        />
      );
    case "ready":
      return (
        <FeedList
          scope="friends"
          onRetry={gate.open}
          empty={
            <QuietLine
              text="Follow traders to see what they do"
              action={{ label: "Find people", onPress: onFindPeople }}
            />
          }
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
  /** What leads the list when it has something to show (Global's pinned card). */
  pinned?: ReactNode;
  /** Runs before a retry (Friends re-checks the session, which is what usually failed). */
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
      {items.length === 0 ? empty : items.map((item, i) => <FeedRow key={item.id} item={item} index={i} />)}
      {feed.hasMore ? (
        <View style={styles.more}>
          <Button
            label="Show more"
            variant="secondary"
            size="sm"
            block={false}
            loading={feed.loadingMore}
            onPress={feed.loadMore}
            style={styles.center}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Four rows fill a phone's first screen of feed. */
const SKELETON_ROWS = ["a", "b", "c", "d"] as const;
/** Skeleton line widths: name and plate, the market line, then two lines of text. */
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
  list: { gap: SPACE.sm },
  more: { paddingTop: SPACE.sm },
  center: { alignSelf: "center" },
  skeletonRow: { flexDirection: "row", gap: SPACE.md, paddingVertical: SPACE.md },
  disc: { width: SIZE.avatarSm, height: SIZE.avatarSm, borderRadius: RADIUS.pill },
  lines: { flex: 1, gap: SPACE.sm },
});
