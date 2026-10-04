import type { Address } from "@senryo/account";
import { type SessionRunner, socialKeys, useFollowList } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Skeleton } from "~/components/kit/states";
import { PersonRow } from "~/features/profile/PersonRow";
import { QuietState } from "~/features/profile/QuietState";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { accountRequiredRoute, type FollowDirection, socialSearchRoute, watchRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DIRECTIONS = [
  { value: "following", label: "Following" },
  { value: "followers", label: "Followers" },
] as const;
/** Placeholder rows while the first page loads. */
const LOADING_ROWS = ["first", "second", "third"] as const;

/**
 * Your following / followers (J9; Fomo F30's people rows): one page, switched in place, with the people listed on the
 * selected network — bare identity rows that open the person. The authenticated owner can read their own lists
 * without publishing their profile; other people still appear only where listed. An empty list is one quiet line.
 * Follow controls and relation state belong to Social's people rows (J8); this page reads.
 */
export default function Follows() {
  const params = useLocalSearchParams<{ direction?: string }>();
  const direction: FollowDirection = params.direction === "followers" ? "followers" : "following";
  const { color } = useTheme();
  const network = useNetwork();
  const gate = useSessionGate();
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: direction === "following" ? "Following" : "Followers" }} />
      <View style={styles.head}>
        <Segmented
          options={DIRECTIONS}
          value={direction}
          onChange={(next) => router.setParams({ direction: next })}
          label="List"
        />
        <Text style={[TYPE.meta, styles.center, { color: color.text3 }]}>People listed in {network.modeLabel}</Text>
      </View>
      {gate.status === "guest" ? (
        <QuietState
          line="Create an account to follow people"
          action={{
            label: "Create account",
            variant: "primary",
            onPress: () => router.push(accountRequiredRoute("follow")),
          }}
        />
      ) : gate.status === "locked" || gate.status === "failed" ? (
        <QuietState
          line={gate.status === "failed" ? "Couldn’t confirm it’s you" : "Unlock to see your people"}
          action={{ label: gate.status === "failed" ? "Try again" : "Unlock", onPress: gate.open }}
        />
      ) : gate.status !== "ready" || !gate.address || !gate.session ? (
        <LoadingPeople direction={direction} />
      ) : (
        <People address={gate.address} direction={direction} session={gate.session} />
      )}
    </Screen>
  );
}

function People({
  address,
  direction,
  session,
}: {
  address: Address;
  direction: FollowDirection;
  session: SessionRunner;
}) {
  const network = useNetwork();
  const client = useQueryClient();
  const list = useFollowList(address, direction, { session });
  const mode = network.modeLabel;
  if (list.reading.status === "unknown") {
    return <LoadingPeople direction={direction} />;
  }
  if (list.reading.status === "failed") {
    return (
      <QuietState
        line="Couldn’t load this list"
        detail="Check your connection, then try again."
        action={{
          label: "Try again",
          onPress: () => {
            void client.invalidateQueries({ queryKey: socialKeys.ownList(network.chainId, direction, address) });
          },
        }}
      />
    );
  }
  const people = list.reading.value;
  if (people.length === 0) {
    return direction === "following" ? (
      <QuietState
        line={`You aren’t following anyone in ${mode} yet`}
        action={{ label: "Find people", onPress: () => router.navigate(socialSearchRoute("traders")) }}
      />
    ) : (
      <QuietState line={`No followers in ${mode} yet`} />
    );
  }
  return (
    <View>
      {people.map((person, index) => (
        <PersonRow
          key={person.address}
          person={person}
          index={index}
          onPress={() => router.push(watchRoute(person.address) as Href)}
        />
      ))}
      {list.hasMore ? (
        <Button label="Show more" variant="ghost" loading={list.loadingMore} onPress={list.loadMore} />
      ) : null}
    </View>
  );
}

function LoadingPeople({ direction }: { direction: FollowDirection }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Loading ${direction}`}>
      {LOADING_ROWS.map((row) => (
        <View key={row} style={styles.loadingRow}>
          <Avatar size={SIZE.markDetail} />
          <View style={styles.loadingText}>
            <Skeleton width="46%" />
            <Skeleton width="28%" height={SIZE.skeletonSmall} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  head: { gap: SPACE.sm },
  center: { textAlign: "center" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  loadingText: { flex: 1, gap: SPACE.sm },
});
