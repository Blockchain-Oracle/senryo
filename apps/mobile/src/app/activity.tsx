import { engineMarket } from "@senryo/config";
import type { FeedItem } from "@senryo/query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { useDockInset } from "~/components/shell/dock-context";
import { FeedRow, type LogoOf } from "~/features/activity/FeedRow";
import { ReceiptBody } from "~/features/activity/Receipt";
import { type FeedFilter, useFeed } from "~/features/activity/useFeed";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { OrdersLink } from "~/features/positions/OrdersLink";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { DIAGNOSIS_COPY } from "~/lib/copy/diagnosis";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Rows the loading list holds the place of (B12: 6 row skeletons). */
const LOADING_ROWS = 6;
const TABS: readonly { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "money", label: "Money" },
  { value: "card", label: "Card" },
];

/**
 * Activity (flow book B12; plan §0.9): every movement of this account on this network — trades, money in and out,
 * card events — under All · Trades · Money · Card. This phone's own operations (sends, withdrawals, swaps, bridges,
 * purchases) join the indexer's events, and the ones still settling sit on top with a spinner; nothing is ever
 * resent from here. A row opens its receipt (Share, Explorer). `?market=XAU` is one market's history.
 */
export default function ActivityScreen() {
  const { color } = useTheme();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const { market: symbol, filter: linked } = useLocalSearchParams<{ market?: string; filter?: string }>();
  const meta = symbol ? engineMarket(symbol.toUpperCase()) : undefined;
  // `?filter=card`: the Card tab's "See all" opens on the card's own rows (E6).
  const [filter, setFilter] = useState<FeedFilter>(() => TABS.find((t) => t.value === linked)?.value ?? "all");
  // The receipt keeps its item while it slides away, so the sheet never empties mid-exit.
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<FeedItem>();
  const feed = useFeed(address, meta ? "trades" : filter, meta ? `ours-${meta.id}` : undefined);
  const money = useMoneyAssets();
  const logoOf: LogoOf = useCallback(
    (markId) => [...money.assets, ...money.other].find((a) => a.mark === markId)?.logoUrl ?? null,
    [money.assets, money.other],
  );
  const refresh = usePullRefresh(address ? feed.refetch : undefined);
  const bottom = useDockInset();
  const title = meta ? `${meta.name} history` : "Activity";
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={styles.fill}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(bottom, SPACE.xxxl) }]}
        refreshControl={refresh}
      >
        {!address ? (
          <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
            Your money and trades show here
          </QuietLine>
        ) : (
          <>
            {meta ? null : <UnderlineTabs options={TABS} value={filter} onChange={setFilter} label="Activity kind" />}
            {!meta && (filter === "all" || filter === "trades") ? <OrdersLink /> : null}
            {feed.error ? (
              <View style={styles.error}>
                <Text style={[TYPE.rowDetail, { color: color.warn }]}>{DIAGNOSIS_COPY[feed.error.kind].headline}</Text>
                <Button label="Retry" variant="ghost" size="sm" block={false} onPress={() => void feed.refetch()} />
              </View>
            ) : null}
            {feed.items === undefined ? (
              <PositionRowsSkeleton rows={LOADING_ROWS} />
            ) : feed.items.length === 0 ? (
              feed.error ? null : (
                <QuietLine
                  {...(meta || filter === "trades" || filter === "card"
                    ? {}
                    : { action: { label: "Add money", onPress: () => router.push(ROUTES.addMoney) } })}
                >
                  {meta ? `No ${meta.name} trades yet` : filter === "all" ? "No activity yet" : "Nothing here yet"}
                </QuietLine>
              )
            ) : (
              <View>
                {feed.items.map((item, i) => (
                  <FeedRow
                    key={item.id}
                    item={item}
                    index={i}
                    logoOf={logoOf}
                    onPress={() => {
                      setReceipt(item);
                      setOpen(true);
                    }}
                  />
                ))}
                {feed.hasMore ? (
                  <Button label="Show earlier" variant="ghost" loading={feed.loadingMore} onPress={feed.loadMore} />
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <ChildSheet open={open} onClose={() => setOpen(false)} title={receipt?.title ?? "Receipt"}>
        {receipt && address ? (
          <ReceiptBody item={receipt} me={address} chainId={network.chainId} logoOf={logoOf} />
        ) : (
          <View style={{ height: SIZE.touch }} />
        )}
      </ChildSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter, gap: SPACE.lg },
  error: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
});
