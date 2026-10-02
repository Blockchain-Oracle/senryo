/**
 * Notifications (G1; §0.9 "Notifications"): the bell's page. A pushed page with its own bar — back, "Notifications",
 * the channels gear (and + on Alerts) — then underline tabs All · Alerts. All is the inbox from the push ledger,
 * grouped Today / Earlier; opening it marks everything up to the newest row read (the bell clears), while rows that
 * were unread keep their raised fill for this visit. Alerts is the price-alert list (C9): tap to edit (Save replaces),
 * × to delete, + for a new one. Guests, a locked session, loading, empty and failure each say one true thing.
 */
import type { AppNotification } from "@senryo/api-client";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { Plus, Settings } from "~/components/kit/symbols";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { AlertSheet, type AlertSheetState, AlertsList } from "~/features/markets/AlertsScreen";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { QuietLine } from "~/features/markets/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";
import { InboxList, openNotification } from "./InboxList";
import { PushBanner } from "./PushBanner";
import { useInbox } from "./useInbox";

export type InboxTab = "all" | "alerts";
const TABS = [
  { value: "all", label: "All" },
  { value: "alerts", label: "Alerts" },
] as const;

export function NotificationsScreen({ initialTab = "all" }: { initialTab?: InboxTab }) {
  const { color } = useTheme();
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [sheet, setSheet] = useState<AlertSheetState>();
  const hasAccount = useAccount().hint !== undefined;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        right={
          <View style={styles.utilities}>
            {tab === "alerts" && hasAccount ? (
              <UtilityButton label="New alert" onPress={() => setSheet("pick")}>
                <Plus size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
              </UtilityButton>
            ) : null}
            <UtilityButton label="Notification settings" onPress={() => router.push(ROUTES.accountNotifications)}>
              <Settings size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          </View>
        }
      >
        <PageTitle>Notifications</PageTitle>
      </PageHeader>
      <View style={styles.tabs}>
        <UnderlineTabs options={TABS} value={tab} onChange={setTab} label="Notifications" />
      </View>
      <Screen>
        {tab === "all" ? (
          <Inbox />
        ) : (
          <AlertsList onNew={() => setSheet("pick")} onEdit={(a) => setSheet({ marketId: a.marketId, editing: a })} />
        )}
      </Screen>
      <AlertSheet open={sheet} onClose={() => setSheet(undefined)} onPick={(marketId) => setSheet({ marketId })} />
    </View>
  );
}

function Inbox() {
  const account = useAccount();
  const network = useNetwork();
  const inbox = useInbox();
  const items = inbox.reading.status === "fresh" || inbox.reading.status === "stale" ? inbox.reading.value.items : [];
  /** The rows unread when the inbox opened: they keep their fill for this visit after the server marks them read. */
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const marked = useRef(false);
  const newest = items[0]?.createdAt;
  const mark = inbox.markRead.mutate;
  useEffect(() => {
    if (marked.current || newest === undefined) return;
    marked.current = true;
    setSeen(new Set(items.filter((n) => n.readAt === null).map((n) => n.id)));
    // Opening the inbox clears the bell: everything up to the newest row on screen is read.
    if (items.some((n) => n.readAt === null)) mark({ before: newest });
  }, [newest, items, mark]);

  if (inbox.access === "loading") return null;
  if (inbox.access === "guest") {
    return (
      <View style={styles.quiet}>
        <QuietLine>Notifications need an account</QuietLine>
        <Button label="Create account" size="sm" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
      </View>
    );
  }
  if (inbox.access === "locked") {
    return (
      <View style={styles.quiet}>
        <QuietLine>Unlock to see notifications</QuietLine>
        <Button label="Unlock" size="sm" block={false} onPress={() => void account.unlock().catch(() => undefined)} />
      </View>
    );
  }
  const open = (n: AppNotification) => {
    if (n.readAt === null) mark({ ids: [n.id] });
    openNotification(n, network.chainId);
  };
  return (
    <View style={styles.list}>
      <PushBanner />
      <ReadingView reading={inbox.reading} loading="list" loadingLabel="Loading notifications" retry={inbox.retry}>
        {(page) =>
          page.items.length === 0 ? (
            <QuietLine>No notifications yet</QuietLine>
          ) : (
            <View style={styles.list}>
              <InboxList items={page.items} unread={seen} onOpen={open} />
              {inbox.hasMore ? (
                <Button
                  label="Load more"
                  variant="ghost"
                  size="sm"
                  loading={inbox.loadingMore}
                  onPress={inbox.loadMore}
                />
              ) : null}
            </View>
          )
        }
      </ReadingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  utilities: { flexDirection: "row", gap: SPACE.sm },
  tabs: { paddingHorizontal: SIZE.gutter },
  quiet: { alignItems: "center" },
  list: { gap: SPACE.lg },
});
