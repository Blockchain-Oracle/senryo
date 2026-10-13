/**
 * The Proof feed on the phone (stage P2; the web's `/proof/`, S7.7): every window anyone called in, newest first — the
 * market, its lane and time, how it closed against its line and how many calls rode it — each opening the window's
 * proof here, not in the browser. `?market=BTC` keeps one market's windows (the market page's "Proof").
 */
import { marketOf, proofWindowPath, windowRow } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useWindows } from "@senryo/query";
import { type Href, router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { SPACE, TYPE, useTheme } from "~/theme";

const MARK = 32;

export function ProofFeedScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ market?: string }>();
  const asked = params.market?.toUpperCase();
  const market = asked && marketOf(asked) ? asked : undefined;
  const q = useWindows(market);
  const windows = q.data?.pages.flatMap((p) => p.windows) ?? [];
  return (
    <Screen onRefresh={() => q.refetch()}>
      <Stack.Screen
        options={{ title: market ? `${market} proof` : "Proof", headerShown: true, headerBackTitle: "Back" }}
      />
      <Text style={[TYPE.body, { color: color.text2 }]}>
        Every window with calls and the two prices that decided it, each posted on chain. Open one to re-check it.
      </Text>
      {q.status === "error" ? (
        <EmptyState why="The proof feed didn't load" action={{ label: "Try again", onPress: () => void q.refetch() }} />
      ) : q.status === "pending" ? (
        <LoadingState label="Loading the proof feed" />
      ) : windows.length === 0 ? (
        <EmptyState why={`No ${market ? `${market} ` : ""}window has calls yet`} />
      ) : (
        <View style={styles.list}>
          <Panel>
            {windows.map((w) => {
              const row = windowRow(w);
              return (
                <ListRow
                  key={w.windowId}
                  title={row.title}
                  detail={row.detail}
                  leading={<EntityMark id={marketId(w.symbol)} size={MARK} decorative />}
                  onPress={() => router.push(proofWindowPath(w.windowId) as Href)}
                />
              );
            })}
          </Panel>
          {q.hasNextPage ? (
            <Button
              label={q.isFetchingNextPage ? "Loading…" : "Older windows"}
              variant="outline"
              size="sm"
              block={false}
              disabled={q.isFetchingNextPage}
              onPress={() => void q.fetchNextPage()}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md, alignItems: "stretch" },
});
