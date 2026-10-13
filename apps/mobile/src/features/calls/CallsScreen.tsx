/**
 * Calls (S5.11): the caller's record on this network (R5.20 `StatsCard`), then what's open now, live
 * (R5.3: the book's positions with their Cash out; open parlays, event calls and duels), and every call before it, newest first, filtered
 * All · Won · Lost · Refunded (21st.dev ssychui/trade-journal-table #27124: outcome words with a check or cross, never colour alone).
 * Every row opens its receipt. Pull to refresh; the user's stream keeps both lists true.
 */

import type { RowMark, RowOpen } from "@senryo/calls";
import {
  CALL_FILTERS,
  type CallFilter,
  filterRows,
  type CallRow as Row,
  useCallRows,
  useLiveBook,
} from "@senryo/calls/react";
import { usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { Layers, Swords, Trophy } from "~/components/kit/symbols";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { eventRoute } from "~/features/events/EventCard";
import { OpenParlays } from "~/features/parlay/ParlayList";
import { PositionsList } from "~/features/positions/PositionsList";
import { fire } from "~/feedback/fire";
import { useAppTrader } from "~/lib/account/guest";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { StatsCard } from "./StatsCard";

const MARK = 36;

/** Where a history row goes: a receipt, or the place an event call, parlay or duel lives (D1). */
function hrefOf(o: RowOpen): Href {
  switch (o.kind) {
    case "call":
      return `/calls/${o.id}` as Href;
    case "ride":
      return `/calls/rides/${o.id}` as Href;
    case "event":
      return eventRoute(o.eventId);
    case "parlay":
      return "/parlay" as Href;
    case "duel":
      return "/duel" as Href;
  }
}

const PLACE_ICON = { event: Trophy, parlay: Layers, duel: Swords } as const;

/** A market's own mark, or the place's nav icon in the same circle. */
function RowMarkView({ mark }: { mark: RowMark }) {
  const { color } = useTheme();
  if (mark.kind === "market") return <EntityMark id={marketId(mark.symbol)} size={MARK} decorative />;
  const Glyph = PLACE_ICON[mark.kind];
  return (
    <View style={[styles.place, { backgroundColor: color.raised2 }]}>
      <Glyph size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ink} />
    </View>
  );
}

function CallRowView({ row }: { row: Row }) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const tint = row.tone === "up" ? color.up : row.tone === "down" ? color.down : color.inkMuted;
  const title = row.title;
  const result = masked(row.result, hidden);
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${row.status}, ${result}. ${row.open.kind === "call" || row.open.kind === "ride" ? "Open the receipt" : "Open"}`}
      onPress={() => {
        fire("tick");
        router.push(hrefOf(row.open));
      }}
    >
      <RowMarkView mark={row.mark} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
          {title}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {row.tag} · {masked(usd(row.stake), hidden)} · {row.status}
        </Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: tint }]}>{result}</Text>
    </Pressable>
  );
}

export function CallsScreen() {
  const owner = useAppTrader().owner;
  const list = useCallRows(owner);
  const book = useLiveBook();
  const client = useQueryClient();
  const [filter, setFilter] = useState<CallFilter>("all");
  const refresh = () =>
    client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "markets" || q.queryKey[0] === "history" });
  const { color } = useTheme();
  const all = list.rows;
  const rows = filterRows(all, filter);
  // A failed history never reads as "No calls yet"; open positions stay on screen either way (P2).
  const failed = list.failed && all.length === 0;
  const holding = book.entries.length > 0 || book.parlays > 0 || list.open.length > 0;

  if (!owner)
    return (
      <CollapsingScreen left={<TabTitle>Calls</TabTitle>}>
        <EmptyState
          why="Your calls live here"
          detail="Every call, its result and its receipt."
          action={{ label: "Create account", onPress: () => router.push(accountRequiredRoute("make a call")) }}
        />
      </CollapsingScreen>
    );

  return (
    <CollapsingScreen left={<TabTitle>Calls</TabTitle>} onRefresh={refresh}>
      {list.pending && all.length === 0 && !holding ? (
        <LoadingState />
      ) : failed && !holding ? (
        <EmptyState
          why="Your calls didn't load"
          detail="Pull down to refresh, or try again."
          action={{ label: "Try again", onPress: list.retry }}
        />
      ) : all.length === 0 && !holding ? (
        <EmptyState
          why="No calls yet"
          detail="Call the next move on BTC, ETH or SOL."
          action={{ label: "Open the terminal", onPress: () => router.push("/trade") }}
        />
      ) : (
        <View style={styles.body}>
          <StatsCard owner={owner} />
          <PositionsList empty="none" />
          <OpenParlays owner={owner} />
          {/* Event calls waiting for their answer and duels under way, with the rest of what's open (D1). */}
          {list.open.map((r) => (
            <CallRowView key={r.key} row={r} />
          ))}
          <Segmented options={CALL_FILTERS} value={filter} onChange={setFilter} label="Show calls" />
          {failed ? (
            <Pressable accessibilityRole="button" onPress={list.retry} style={styles.more}>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>Your history didn't load.</Text>
              <Text style={[TYPE.rowTitle, { color: color.link }]}>Try again</Text>
            </Pressable>
          ) : list.pending && all.length === 0 ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <Text style={[TYPE.caption, styles.none, { color: color.inkMuted }]}>None here yet.</Text>
          ) : (
            rows.map((r) => <CallRowView key={r.key} row={r} />)
          )}
          {list.hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: list.loadingMore, disabled: list.loadingMore }}
              disabled={list.loadingMore}
              onPress={list.loadMore}
              style={styles.more}
            >
              <Text style={[TYPE.rowTitle, { color: color.link }]}>
                {list.loadingMore ? "Loading…" : "Show older calls"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm },
  place: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.lg },
  text: { flex: 1 },
  none: { paddingVertical: SPACE.lg, textAlign: "center" },
  more: { minHeight: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
