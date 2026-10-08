/**
 * Calls (S5.11): the caller's record on this network (result, calls, won, best streak), then what's open now (the
 * services' ticket book, live) and every call before it (the indexer), newest first, filtered All · Open · Won · Lost ·
 * Refunded (21st.dev ssychui/trade-journal-table #27124: outcome words with a check or cross, never colour alone).
 * Every row opens its receipt. Pull to refresh; the user's stream keeps both lists true.
 */
import { marketId } from "@senryo/identity";
import { useCallerStats, useCalls, useTickets } from "@senryo/query";
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
import { lane, OPEN_STATES, sideName, signedUsd, stateWord, type Tone, toneOf, usd } from "./format";

const MARK = 36;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "refunded", label: "Refunded" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

interface Row {
  key: string;
  ticketId: bigint;
  symbol: string;
  cadenceSec: number;
  band: number;
  stake: bigint;
  status: string;
  result: string;
  tone: Tone;
  group: Exclude<Filter, "all">;
}

function CallRow({ row }: { row: Row }) {
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
  const tickets = useTickets(owner);
  const calls = useCalls(owner);
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const refresh = () =>
    client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "markets" || q.queryKey[0] === "history" });
  const { color } = useTheme();

  const open: Row[] =
    "value" in tickets
      ? tickets.value.tickets
          .filter((t) => OPEN_STATES.has(t.state))
          .map((t) => ({
            key: `open-${t.ticketId}`,
            ticketId: t.ticketId,
            symbol: t.symbol,
            cadenceSec: t.cadenceSec,
            band: t.band,
            stake: t.stake,
            status: stateWord({ status: t.state, outcome: null }),
            result: t.state === "committed" ? "…" : `pays ${usd(t.payout)}`,
            tone: "muted" as const,
            group: "open" as const,
          }))
      : [];
  const past: Row[] = (calls.data?.pages ?? [])
    .flatMap((p) => p.calls)
    .filter((c) => !OPEN_STATES.has(c.status))
    .map((c) => {
      const pnl = c.pnl === null ? null : BigInt(c.pnl);
      const refunded = c.status === "refunded" || c.outcome === "refund";
      return {
        key: `call-${c.ticketId}`,
        ticketId: c.ticketId,
        symbol: c.symbol,
        cadenceSec: c.cadenceSec,
        band: c.band,
        stake: c.stake,
        status: stateWord(c),
        result: pnl === null ? "—" : signedUsd(pnl),
        tone: toneOf(pnl),
        group: refunded ? ("refunded" as const) : pnl !== null && pnl > 0n ? ("won" as const) : ("lost" as const),
      };
    });
  const all = [...open, ...past];
  const rows = filter === "all" ? all : all.filter((r) => r.group === filter);

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
      {calls.isPending && all.length === 0 ? (
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
          <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Show calls" />
          {rows.length === 0 ? (
            <Text style={[TYPE.caption, styles.none, { color: color.inkMuted }]}>None here yet.</Text>
          ) : (
            rows.map((r) => <CallRow key={r.key} row={r} />)
          )}
          {calls.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!calls.isFetchingNextPage) void calls.fetchNextPage();
              }}
              style={styles.more}
            >
              <Text style={[TYPE.rowTitle, { color: color.link }]}>
                {calls.isFetchingNextPage ? "Loading…" : "Show older calls"}
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
