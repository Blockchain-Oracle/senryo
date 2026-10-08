/**
 * Notifications (G1; §0.9 "Notifications"): the bell's page. A pushed page with its own bar — back, "Notifications",
 * the channels gear — then the inbox from the push ledger, grouped Today / Earlier; opening it marks everything up to
 * the newest row read (the bell clears), while rows that were unread keep their raised fill for this visit. Market
 * alerts return with S8 (D-256). Guests, a locked session, loading, empty and failure each say one true thing.
 */
import type { AppNotification } from "@senryo/api-client";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { PageHeader, PageTitle } from "~/components/kit/PageHeader";
import { QuietLine } from "~/components/kit/QuietLine";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { Settings } from "~/components/kit/symbols";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";
import { InboxList, openNotification } from "./InboxList";
import { PushBanner } from "./PushBanner";
import { useInbox } from "./useInbox";

export function NotificationsScreen() {
  const { color } = useTheme();
  const account = useAccount();
  const network = useNetwork();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        right={
          <View style={styles.utilities}>
            <UtilityButton label="Notification settings" onPress={() => router.push(ROUTES.accountNotifications)}>
              <Settings size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          </View>
        }
      >
        <PageTitle>Notifications</PageTitle>
      </PageHeader>
      <Screen>
        <Inbox key={`${network.chainId}:${account.hint?.address ?? "guest"}`} />
      </Screen>
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
    if (inbox.access !== "ready" || marked.current || newest === undefined) return;
    marked.current = true;
    setSeen(new Set(items.filter((n) => n.readAt === null).map((n) => n.id)));
    // Opening the inbox clears the bell: everything up to the newest row on screen is read.
    if (items.some((n) => n.readAt === null)) mark({ before: newest });
  }, [newest, items, mark, inbox.access]);

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
  quiet: { alignItems: "center" },
  list: { gap: SPACE.lg },
});
