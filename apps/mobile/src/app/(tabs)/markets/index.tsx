import { type ChainId, ENGINE_MARKETS, engineMarketsOn, MAINNET_CHAIN_ID } from "@senryo/config";
import { entity, ids, PERPL_MARKETS, perplMarketId } from "@senryo/identity";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { Panel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { ProtocolBanner } from "~/features/markets/MarketBanners";
import { EngineMarketRow, type UpcomingMarket, UpcomingMarketRow } from "~/features/markets/MarketRow";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { HAIRLINE_PX, SPACE, TYPE, useTheme } from "~/theme";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "commodities", label: "Commodities" },
  { value: "fx", label: "FX" },
  { value: "crypto", label: "Crypto" },
  { value: "equities", label: "Equities" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

type UpcomingClass = Exclude<Filter, "all" | "commodities">;
const FX_QUOTE = "USD";

/**
 * Markets that aren't live on this network yet — identity and why, never a price (plan §2.5). Crypto: every market
 * Perpl lists on mainnet (S7 brings them onto this ticket). FX: the engine's pairs until they are listed here.
 * Equities wait for a live price feed (D-220).
 */
function upcomingMarkets(chainId: ChainId): ReadonlyArray<UpcomingMarket & { assetClass: UpcomingClass }> {
  const listed = engineMarketsOn(chainId);
  const crypto = Object.keys(PERPL_MARKETS[MAINNET_CHAIN_ID] ?? {}).map((symbol) => {
    const mark = perplMarketId(MAINNET_CHAIN_ID, symbol) ?? ids.equity(symbol);
    return {
      symbol,
      name: entity(mark)?.name ?? symbol,
      venue: "Perpl" as const,
      note: "Mainnet · arriving next",
      assetClass: "crypto" as const,
      mark,
    };
  });
  const fx = ENGINE_MARKETS.filter((m) => m.category === "fx" && !listed.some((l) => l.id === m.id)).map((m) => ({
    symbol: `${m.symbol}/${FX_QUOTE}`,
    name: m.name,
    venue: "Senryo" as const,
    note: chainId === MAINNET_CHAIN_ID ? "Lists with the mainnet launch" : "Listing on practice after the timelock",
    assetClass: "fx" as const,
    mark: ids.fxPair(m.symbol, FX_QUOTE),
  }));
  const equities = [
    {
      symbol: "NVDA",
      name: "Nvidia",
      venue: "Senryo" as const,
      note: "Waits for a live price feed",
      assetClass: "equities" as const,
      mark: ids.equity("NVDA"),
    },
  ];
  return [...crypto, ...fx, ...equities];
}

/**
 * Markets tab root (S1b.7 shell; J3 rebuilds the list in S1b.9): the title and mode stay in the fixed bar and the
 * category chips pin under it (C16, direction §5). Browsable without an account (F03). Mainnet before launch shows
 * live prices read-only (S8.22). A row opens market detail on this stack; the ticket opens from there.
 */
export default function Markets() {
  const readOnly = useReadOnlyNetwork();
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <CollapsingScreen
      tab="markets"
      left={<TabTitle>Markets</TabTitle>}
      sticky={
        readOnly ? undefined : (
          <View style={styles.chips}>
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} label="Market category" />
          </View>
        )
      }
    >
      {readOnly ? (
        <PrelaunchMainnet surface="markets" />
      ) : (
        <MarketsList filter={filter} onShowAll={() => setFilter("all")} />
      )}
    </CollapsingScreen>
  );
}

function MarketsList({ filter, onShowAll }: { filter: Filter; onShowAll: () => void }) {
  const network = useNetwork();
  const { color } = useTheme();
  const listed = engineMarketsOn(network.chainId);
  const engine = listed.filter(
    (m) =>
      filter === "all" ||
      (filter === "commodities" && m.category === "metal") ||
      (filter === "fx" && m.category === "fx"),
  );
  const upcoming = upcomingMarkets(network.chainId).filter((m) => filter === "all" || m.assetClass === filter);
  const count = engine.length + upcoming.length;
  return (
    <>
      <ProtocolBanner />
      {count === 0 ? (
        <EmptyState
          why="Nothing in this category yet"
          detail="Markets appear here as they are listed on this network."
          action={{ label: "Show all markets", onPress: onShowAll }}
        />
      ) : (
        <Panel>
          <View style={[styles.head, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.rowStrong, { color: color.ink }]}>Perps · 24h</Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>Oracle: Chainlink</Text>
          </View>
          {engine.map((m, i) => (
            <EngineMarketRow key={m.id} marketId={m.id} first={i === 0} />
          ))}
          {upcoming.map((m, i) => (
            <UpcomingMarketRow key={m.symbol} market={m} first={engine.length === 0 && i === 0} />
          ))}
        </Panel>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { paddingVertical: SPACE.sm },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACE.md,
    borderBottomWidth: HAIRLINE_PX,
  },
});
