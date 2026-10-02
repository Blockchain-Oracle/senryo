import { engineMarket } from "@senryo/config";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { ActivityRow } from "~/features/portfolio/ActivityRow";
import { ACTIVITY_FILTERS, type ActivityFilter, FILTER_KINDS } from "~/features/portfolio/activity-copy";
import { PendingOperations } from "~/features/portfolio/PendingOperations";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useActivity } from "~/features/portfolio/useActivity";
import { OrdersLink } from "~/features/positions/OrdersLink";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE } from "~/theme";

/** Rows the loading list holds the place of. */
const LOADING_ROWS = 6;

/**
 * Activity history (direction's screen inventory): every indexed event of this account on this network — trades,
 * money in and out, card holds, TP/SL — newest first, bare rows on the page under filter chips, a page at a time.
 * Each row is an onchain event and opens its transaction. A guest and an account with no events each get one quiet
 * line; nothing is sampled or invented.
 */
export default function ActivityScreen() {
  const address = useAccount().hint?.address;
  const { market: symbol } = useLocalSearchParams<{ market?: string }>();
  // `?market=XAU`: one market's history (FT097, F32's history utility on market detail).
  const meta = symbol ? engineMarket(symbol.toUpperCase()) : undefined;
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const activity = useActivity(
    address,
    filter === "all" ? undefined : FILTER_KINDS[filter],
    meta ? `ours-${meta.id}` : undefined,
  );
  return (
    <Screen {...(address ? { onRefresh: activity.refetch } : {})} contentStyle={styles.body}>
      <Stack.Screen options={{ title: meta ? `${meta.name} history` : "Activity" }} />
      {address ? (
        <>
          {!meta && filter === "all" ? <PendingOperations /> : null}
          {!meta && filter === "all" ? <OrdersLink /> : null}
          <View style={styles.chips}>
            <ChipRow options={ACTIVITY_FILTERS} value={filter} onChange={setFilter} label="Activity kind" />
          </View>
          {activity.reading.status === "unknown" ? (
            <PositionRowsSkeleton rows={LOADING_ROWS} />
          ) : (
            <ReadingView reading={activity.reading} retry={() => void activity.refetch()}>
              {(rows) =>
                rows.length === 0 ? (
                  <QuietLine>
                    {meta
                      ? `You haven’t traded ${meta.name} on this network yet`
                      : filter === "all"
                        ? "No activity yet"
                        : "Nothing of this kind yet"}
                  </QuietLine>
                ) : (
                  <View>
                    {rows.map((row) => (
                      <ActivityRow key={row.id} row={row} />
                    ))}
                    {activity.hasMore ? (
                      <Button
                        label="Show earlier"
                        variant="ghost"
                        loading={activity.loadingMore}
                        onPress={activity.loadMore}
                      />
                    ) : null}
                  </View>
                )
              }
            </ReadingView>
          )}
        </>
      ) : (
        <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
          Your trades, deposits and card activity appear here once you have an account.
        </QuietLine>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md },
  // The chips run to both screen edges; `ChipRow` keeps its own gutter.
  chips: { marginHorizontal: -SIZE.gutter },
});
