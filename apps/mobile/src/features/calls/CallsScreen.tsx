/**
 * Calls (S5.11): the caller's record on this network (result, calls, won, best streak), then what's open now (the
 * services' ticket book, live) and every call before it (the indexer), newest first, filtered All · Open · Won · Lost ·
 * Refunded (21st.dev ssychui/trade-journal-table #27124: outcome words with a check or cross, never colour alone).
 * Every row opens its receipt. Pull to refresh; the user's stream keeps both lists true.
 */

import { CALL_FILTERS, type CallFilter, filterRows, type CallRow as Row, useCallRows } from "@senryo/calls/react";
import { lane, sideName, signedUsd, toneOf, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCallerStats } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 36;

function CallRowView({ row }: { row: Row }) {
  const { color } = useTheme();
  const tint = row.tone === "up" ? color.up : row.tone === "down" ? color.down : color.inkMuted;
  const title = `${row.symbol} ${sideName(row.band)}`;
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${row.status}, ${row.result}. Open the receipt`}
      onPress={() => {
        fire("tick");
        router.push(`/calls/${row.ticketId}` as Href);
      }}
    >
      <EntityMark id={marketId(row.symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{title}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {lane(row.cadenceSec)} · {usd(row.stake)} · {row.status}
        </Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: tint }]}>{row.result}</Text>
    </Pressable>
  );
}

/** The record on this network, one line: the result first, then the counts. */
function Record({ owner }: { owner: `0x${string}` }) {
  const { color } = useTheme();
  const stats = useCallerStats(owner);
  if (!("value" in stats) || stats.value.calls === 0) return null;
  const s = stats.value;
  const pnl = BigInt(s.pnl);
  const tone = toneOf(pnl);
  return (
    <View
      style={styles.record}
      accessible
      accessibilityLabel={`Result ${signedUsd(pnl)}, ${s.calls} calls, ${s.wins} won`}
    >
      <Text style={[TYPE.title, { color: tone === "up" ? color.up : tone === "down" ? color.down : color.ink }]}>
        {signedUsd(pnl)}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {s.calls} {s.calls === 1 ? "call" : "calls"} · {s.wins} won · {s.losses} lost · best streak {s.bestStreak}
      </Text>
    </View>
  );
}

export function CallsScreen() {
  const owner = useAccount().hint?.address;
  const list = useCallRows(owner);
  const client = useQueryClient();
  const [filter, setFilter] = useState<CallFilter>("all");
  const refresh = () =>
    client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "markets" || q.queryKey[0] === "history" });
  const { color } = useTheme();
  const all = list.rows;
  const rows = filterRows(all, filter);

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
      {list.pending && all.length === 0 ? (
        <LoadingState />
      ) : all.length === 0 ? (
        <EmptyState
          why="No calls yet"
          detail="Call the next move on BTC, ETH or SOL."
          action={{ label: "Open the terminal", onPress: () => router.push("/trade") }}
        />
      ) : (
        <View style={styles.body}>
          <Record owner={owner} />
          <Segmented options={CALL_FILTERS} value={filter} onChange={setFilter} label="Show calls" />
          {rows.length === 0 ? (
            <Text style={[TYPE.caption, styles.none, { color: color.inkMuted }]}>None here yet.</Text>
          ) : (
            rows.map((r) => <CallRowView key={r.key} row={r} />)
          )}
          {list.hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                list.loadMore();
              }}
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
  record: { gap: SPACE.xxs, paddingBottom: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.lg },
  text: { flex: 1 },
  none: { paddingVertical: SPACE.lg, textAlign: "center" },
  more: { minHeight: SIZE.touch, alignItems: "center", justifyContent: "center" },
});
