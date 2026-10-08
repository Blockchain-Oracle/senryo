/**
 * Calls (S5.11): what's open now (the services' ticket book, live) and every call before it (the indexer), newest
 * first, each with its market mark, side, stake and result. Pull to refresh; the user's stream keeps both true.
 */
import { formatUnits } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useCalls, useTickets } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MARK = 36;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SIDE: Record<number, string> = { 0: "Up", 1: "Down", 2: "Range", 3: "Moonshot", 4: "Crash" };
const OPEN = new Set(["committed", "open", "closing"]);
const SECONDS_PER_MINUTE = 60;

const usd = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
const lane = (cadenceSec: number) => `${cadenceSec / SECONDS_PER_MINUTE}m`;

interface Row {
  key: string;
  symbol: string;
  cadenceSec: number;
  band: number;
  stake: bigint;
  status: string;
  result: string;
  tone: "up" | "down" | "muted";
}

function CallRow({ row }: { row: Row }) {
  const { color } = useTheme();
  const tint = row.tone === "up" ? color.up : row.tone === "down" ? color.down : color.inkMuted;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${row.symbol} ${SIDE[row.band] ?? ""}, ${row.result}`}>
      <EntityMark id={marketId(row.symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>
          {row.symbol} {SIDE[row.band] ?? `Band ${row.band}`}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {lane(row.cadenceSec)} · {usd(row.stake)} · {row.status}
        </Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: tint }]}>{row.result}</Text>
    </View>
  );
}

export function CallsScreen() {
  const owner = useAccount().hint?.address;
  const tickets = useTickets(owner);
  const calls = useCalls(owner);
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "markets" || q.queryKey[0] === "history" });
  const { color } = useTheme();

  const open: Row[] =
    "value" in tickets
      ? tickets.value.tickets
          .filter((t) => OPEN.has(t.state))
          .map((t) => ({
            key: `open-${t.ticketId}`,
            symbol: t.symbol,
            cadenceSec: t.cadenceSec,
            band: t.band,
            stake: t.stake,
            status: t.state === "committed" ? "Opening" : t.state === "closing" ? "Cashing out" : "Live",
            result: t.state === "committed" ? "…" : `pays ${usd(t.payout)}`,
            tone: "muted" as const,
          }))
      : [];
  const past: Row[] = (calls.data?.pages ?? [])
    .flatMap((p) => p.calls)
    .filter((c) => !OPEN.has(c.status))
    .map((c) => {
      const pnl = c.pnl === null ? null : BigInt(c.pnl);
      return {
        key: `call-${c.ticketId}`,
        symbol: c.symbol,
        cadenceSec: c.cadenceSec,
        band: c.band,
        stake: c.stake,
        status:
          c.outcome === "win"
            ? "Won"
            : c.outcome === "refund"
              ? "Refunded"
              : c.status === "closed"
                ? "Cashed out"
                : "Lost",
        result: pnl === null ? "—" : `${pnl < 0n ? "−" : "+"}${usd(pnl)}`,
        tone: pnl === null || pnl === 0n ? ("muted" as const) : pnl > 0n ? ("up" as const) : ("down" as const),
      };
    });
  const rows = [...open, ...past];

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
      {calls.isPending && rows.length === 0 ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          why="No calls yet"
          detail="Call the next move on BTC, ETH or SOL."
          action={{ label: "Open the terminal", onPress: () => router.push("/trade") }}
        />
      ) : (
        <FlatList
          scrollEnabled={false}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={({ item }) => <CallRow row={item} />}
          onEndReached={() => {
            if (calls.hasNextPage && !calls.isFetchingNextPage) void calls.fetchNextPage();
          }}
          ItemSeparatorComponent={() => <View style={{ height: SPACE.xs, backgroundColor: color.ground }} />}
        />
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.lg },
  text: { flex: 1 },
});
