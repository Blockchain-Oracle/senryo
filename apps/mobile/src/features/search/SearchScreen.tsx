import type { AddressStanding, SearchKind, SearchResult } from "@senryo/api-client";
import { engineMarketsOn, PERPL_INSTRUMENTS, type SpotToken } from "@senryo/config";
import { ids } from "@senryo/identity";
import {
  SEARCH_MIN_CHARS,
  socialKeys,
  spotToken,
  useDiscoveryQuotes,
  useQueryEnv,
  useSearch,
  useStandings,
  useTokenPrices,
} from "@senryo/query";
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
import { PerplMarketRow } from "~/features/perpl/PerplMarketRow";
import { TokenRow } from "~/features/tokens/TokenRow";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";
import { SEARCH_FIELD_HEIGHT, SearchField } from "./SearchField";
import { TraderRow } from "./TraderRow";
import { useRecentSearches } from "./useRecentSearches";

const KINDS = [
  { value: "all", label: "All" },
  { value: "tokens", label: "Tokens" },
  { value: "perps", label: "Perps" },
  { value: "traders", label: "Traders" },
] as const;
export type Kind = (typeof KINDS)[number]["value"];

/** The api's kind per tab (Perps are our engine's markets). */
const API_KIND: Record<Kind, SearchKind | undefined> = {
  all: undefined,
  tokens: "tokens",
  perps: "markets",
  traders: "traders",
};

const PLACEHOLDER: Record<Kind, string> = {
  all: "Search for anything",
  tokens: "Token name or symbol",
  perps: "Market name or ticker",
  traders: "Name, @handle or address",
};

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

/** 7d standings for these traders (one read for the list); "loading" until it answers, null when it can't. */
function useWeekResults(addresses: readonly string[]): (address: string) => AddressStanding | null | "loading" {
  const reading = useStandings(addresses, "7d");
  return (address) => {
    if (reading.status === "unknown") return "loading";
    if (reading.status === "failed") return null;
    return reading.value.items.find((s) => s.address.toLowerCase() === address.toLowerCase()) ?? null;
  };
}

/**
 * Search (`/markets/search`, `/social/search`; Fomo F31, F1): All · Tokens · Perps · Traders across the top, results
 * in the page, and the field floating low above the dock with Paste. Tokens are the J11 spot list; Perps are our
 * engine's listings on this network; Traders are profiles listed on it (handle prefix or an exact address), each with
 * their 7d result. Before a search: Recents, kept on this phone per network. Loading, no results and a failed request
 * each say so; a failed request can be retried.
 */
export function SearchScreen({ initialKind = "all" }: { initialKind?: Kind }) {
  const { color } = useTheme();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>(initialKind);
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
      <SearchField value={text} onChange={setText} bottom={dock} placeholder={PLACEHOLDER[kind]} />
    </View>
  );
}

function Results({ query, kind }: { query: string; kind: Kind }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const only = API_KIND[kind];
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
    kind === "all" || kind === "perps"
      ? result.markets.flatMap((m) => listed.find((l) => l.id === m.engineId) ?? [])
      : [];
  const traders = kind === "all" || kind === "traders" ? result.traders : [];
  // Spot tokens (J11): their own list, mainnet pools, shown on either network.
  const tokens = kind === "all" || kind === "tokens" ? result.tokens.flatMap((t) => spotToken(t.symbol) ?? []) : [];
  const weekOf = useWeekResults(traders.map((t) => t.address));
  // Perpl's crypto perps (C1 acceptance: "btc" finds the Perpl perp): matched here by ticker or name.
  const needle = query.trim().toLowerCase();
  const perpl =
    kind === "all" || kind === "perps"
      ? PERPL_INSTRUMENTS.filter(
          (i) => i.symbol.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle),
        )
      : [];
  const perplQuotes = useDiscoveryQuotes(perpl.map((i) => i.id));
  if (markets.length + perpl.length + tokens.length + traders.length === 0) {
    return <QuietLine>{kind === "traders" ? "No traders found" : `No results for “${query}”`}</QuietLine>;
  }
  return (
    <>
      {traders.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Traders</SectionLabel>
          {traders.map((t) => (
            <TraderRow
              key={t.address}
              trader={t}
              standing={weekOf(t.address)}
              onOpen={() =>
                remember({ kind: "trader", address: t.address, handle: t.handle, displayName: t.displayName })
              }
            />
          ))}
        </View>
      ) : null}
      {tokens.length > 0 ? <FoundTokens tokens={tokens} /> : null}
      {markets.length + perpl.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Perps</SectionLabel>
          {markets.map((m) => (
            <EngineMarketRow key={m.id} marketId={m.id} onOpen={() => remember({ kind: "market", symbol: m.symbol })} />
          ))}
          {perplQuotes.map((q) =>
            q.instrument.class === "crypto" ? (
              <PerplMarketRow key={q.instrument.id} instrument={q.instrument} reading={q.reading} />
            ) : null,
          )}
        </View>
      ) : null}
    </>
  );
}

/** A recent search this network can still open; a market carries its engine id. */
interface Resolved {
  recent: RecentSearch;
  marketId?: number;
}

function Recents({ kind }: { kind: Kind }) {
  const network = useNetwork();
  const { recents, remember, clear } = useRecentSearches();
  const listed = engineMarketsOn(network.chainId);
  // Resolved before counting: a market this network no longer lists is dropped, so "Recents" never heads nothing.
  const shown = recents.flatMap((recent): Resolved[] => {
    if (recent.kind === "trader") return kind === "all" || kind === "traders" ? [{ recent }] : [];
    if (kind !== "all" && kind !== "perps") return [];
    const market = listed.find((m) => m.symbol === recent.symbol);
    return market ? [{ recent, marketId: market.id }] : [];
  });
  const weekOf = useWeekResults(shown.flatMap(({ recent }) => (recent.kind === "trader" ? [recent.address] : [])));
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
          <TraderRow
            key={`t:${recent.address}`}
            trader={recent}
            standing={weekOf(recent.address)}
            onOpen={() => remember(recent)}
          />
        ) : marketId === undefined ? null : (
          // A recent market renders live through the market row: its price is read now, never stored.
          <EngineMarketRow key={`m:${recent.symbol}`} marketId={marketId} onOpen={() => remember(recent)} />
        ),
      )}
    </View>
  );
}

/** Matching spot tokens with their live prices (one read for the matches). */
function FoundTokens({ tokens }: { tokens: SpotToken[] }) {
  const prices = useTokenPrices(tokens);
  const priced = prices.status === "fresh" || prices.status === "stale" ? prices.value : undefined;
  return (
    <View>
      <SectionLabel style={styles.label}>Tokens</SectionLabel>
      {tokens.map((t) => (
        <TokenRow
          key={t.symbol}
          token={t}
          priceUsd18={priced ? (priced.find((p) => p.token.symbol === t.symbol)?.priceUsd18 ?? null) : undefined}
          change24hBps={undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  kinds: { paddingBottom: SPACE.sm },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  label: { paddingBottom: SPACE.xs },
  empty: { alignItems: "center", paddingTop: SPACE.xxxl },
  recentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
