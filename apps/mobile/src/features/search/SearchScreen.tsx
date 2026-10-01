import type { SearchResult } from "@senryo/api-client";
import { engineMarketsOn } from "@senryo/config";
import { ids } from "@senryo/identity";
import { SEARCH_MIN_CHARS, socialKeys, useQueryEnv, useSearch } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { SectionLabel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import type { RecentSearch } from "~/features/markets/device-store";
import { EngineMarketRow } from "~/features/markets/MarketRow";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { QuietLine } from "~/features/markets/QuietLine";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";
import { SEARCH_FIELD_HEIGHT, SearchField } from "./SearchField";
import { TraderRow } from "./TraderRow";
import { useRecentSearches } from "./useRecentSearches";

const KINDS = [
  { value: "all", label: "All" },
  { value: "markets", label: "Markets" },
  { value: "traders", label: "Traders" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

/** Typing settles for this long before a request goes out (the hook re-queries per distinct text). */
const DEBOUNCE_MS = 250;
/** The seal behind an empty Recents is a watermark, not a mark (F31's faded logo). */
const WATERMARK_OPACITY = 0.12;

/**
 * The query once typing settles. Text too short to search drops the old query at once, so clearing the field and
 * typing a new word never flashes the previous word's results while the new one settles.
 */
function useSettledQuery(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value.length < SEARCH_MIN_CHARS) {
      setSettled(value);
      return;
    }
    const id = setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value]);
  return settled;
}

/**
 * Search (`/markets/search`; Fomo F31, direction §9): All / Markets / Traders across the top, results in the page,
 * and the field floating low above the dock with Paste and clear. Markets are our engine's listings on this network;
 * traders are profiles listed on it. Tokens are not searchable yet (the api has no token list), so there is no Tokens
 * tab. Before a search: what was opened recently, kept on this phone. Loading, no results and a failed request each
 * say so; a failed request can be retried. A market opens its detail on this stack; a trader opens their page.
 */
export function SearchScreen() {
  const { color } = useTheme();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const dock = useDockInset();
  const query = useSettledQuery(text.trim());
  // Clearing the field returns to Recents at once; only a new query waits for the typing to settle.
  const searching = text.trim().length >= SEARCH_MIN_CHARS && query.length >= SEARCH_MIN_CHARS;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <PageTitle>Search</PageTitle>
      </PageHeader>
      <View style={styles.kinds}>
        <ChipRow options={KINDS} value={kind} onChange={setKind} label="Search in" />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.body, { paddingBottom: dock + SEARCH_FIELD_HEIGHT + SPACE.xl }]}
      >
        {searching ? <Results query={query} kind={kind} /> : <Recents kind={kind} />}
      </ScrollView>
      <SearchField value={text} onChange={setText} bottom={dock} />
    </View>
  );
}

function Results({ query, kind }: { query: string; kind: Kind }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const only = kind === "all" ? undefined : kind;
  const search = useSearch(query, only);
  const retry = () => void client.invalidateQueries({ queryKey: socialKeys.search(env.chainId, query, only) });
  return (
    <ReadingView reading={search} loading="list" loadingLabel="Searching" retry={retry}>
      {(result) => <Found result={result} query={query} kind={kind} />}
    </ReadingView>
  );
}

function Found({ result, query, kind }: { result: SearchResult; query: string; kind: Kind }) {
  const network = useNetwork();
  const { remember } = useRecentSearches();
  // Only markets this network lists can be read and opened; each is kept by our own config's symbol.
  const listed = engineMarketsOn(network.chainId);
  const markets =
    kind === "traders" ? [] : result.markets.flatMap((m) => listed.find((l) => l.id === m.engineId) ?? []);
  const traders = kind === "markets" ? [] : result.traders;
  if (markets.length + traders.length === 0) return <QuietLine>No results for “{query}”</QuietLine>;
  return (
    <>
      {markets.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Markets</SectionLabel>
          {markets.map((m) => (
            <EngineMarketRow key={m.id} marketId={m.id} onOpen={() => remember({ kind: "market", symbol: m.symbol })} />
          ))}
        </View>
      ) : null}
      {traders.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Traders</SectionLabel>
          {traders.map((t) => (
            <TraderRow
              key={t.address}
              trader={t}
              onOpen={() =>
                remember({ kind: "trader", address: t.address, handle: t.handle, displayName: t.displayName })
              }
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

function Recents({ kind }: { kind: Kind }) {
  const network = useNetwork();
  const { recents, remember, clear } = useRecentSearches();
  const listed = engineMarketsOn(network.chainId);
  // Resolved before counting: a market this network no longer lists is dropped, so "Recents" never heads nothing.
  const shown = recents.flatMap((recent): Resolved[] => {
    if (kind !== "all" && (kind === "markets") !== (recent.kind === "market")) return [];
    if (recent.kind === "trader") return [{ recent }];
    const market = listed.find((m) => m.symbol === recent.symbol);
    return market ? [{ recent, marketId: market.id }] : [];
  });
  if (shown.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={{ opacity: WATERMARK_OPACITY }}>
          <EntityMark id={ids.brand("senryo")} size={SIZE.seal} variant="symbol" decorative />
        </View>
        <QuietLine>No recent searches</QuietLine>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.recentsHead}>
        <SectionLabel>Recents</SectionLabel>
        <Button label="Clear" variant="ghost" size="sm" block={false} onPress={clear} />
      </View>
      {shown.map(({ recent, marketId }) =>
        recent.kind === "trader" ? (
          <TraderRow key={`t:${recent.address}`} trader={recent} onOpen={() => remember(recent)} />
        ) : marketId === undefined ? null : (
          // A recent market renders live through the market row: its price is read now, never stored.
          <EngineMarketRow key={`m:${recent.symbol}`} marketId={marketId} onOpen={() => remember(recent)} />
        ),
      )}
    </View>
  );
}

/** A recent search this network can still open; a market carries its engine id. */
interface Resolved {
  recent: RecentSearch;
  marketId?: number;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  kinds: { paddingBottom: SPACE.sm },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  label: { paddingBottom: SPACE.xs },
  empty: { alignItems: "center", paddingTop: SPACE.xxxl },
  recentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
