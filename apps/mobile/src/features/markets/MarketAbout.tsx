/**
 * Market detail's About tab (Fomo F35; flow book C2 step 3; plan §0.9 Market detail): two or three sentences on what
 * the market is (JPY says its orientation: USD per yen, long = the yen rises), a stats grid — Max leverage · Fee ·
 * Spread now · Funding now · Hours · OI long / short — and a "Technical details" disclosure for the feed, its
 * contract or mirror, precision, margins and the oracle's age. Every value is the market's configuration or what the
 * engine and oracle answered in the price's own read; a value that isn't known is left out, never estimated.
 */
import { addressOf } from "@senryo/chain";
import {
  type ChainId,
  type EngineMarket,
  engineMarket,
  explorerAddressUrl,
  marketPair,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { DECIMALS, formatUnits, nextTransition, notional, shortAddress, utcSlotLabel } from "@senryo/core";
import { useCalendar } from "@senryo/query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { borrowApr, fundingForMarket, marketRates } from "~/features/trade/rates";
import { fire } from "~/feedback/fire";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DetailRow, Disclosure } from "./Disclosure";
import { ageLabel, STATUS_LABEL } from "./session";
import type { MarketLine } from "./useMarketLine";
import { useNowSec } from "./useNowSec";

/** 5 bps → "0.05%": a rate in basis points as a percent with two decimals. */
const bpsPct = (bps: bigint) => `${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.cents)}%`;

/** What each market is, in two or three sentences (flow book C2 step 3; C3a for what long and short mean). */
export const MARKET_ABOUT: Record<string, string> = {
  XAU: "Gold, priced in US dollars per troy ounce by Chainlink. Go long if you think gold will rise, short if you think it will fall. Settled in dollars; no metal changes hands.",
  XAG: "Silver, priced in US dollars per troy ounce by Chainlink. Go long if you think silver will rise, short if you think it will fall. Settled in dollars; no metal changes hands.",
  EUR: "The euro against the US dollar (EUR/USD). Long profits when the euro strengthens against the dollar; short profits when it weakens.",
  GBP: "The British pound against the US dollar (GBP/USD). Long profits when the pound strengthens against the dollar; short profits when it weakens.",
  JPY: "The Japanese yen against the US dollar, quoted as dollars per yen (JPY/USD). Long JPY means the yen rises against the dollar; short means it falls.",
  CHF: "The Swiss franc against the US dollar (CHF/USD). Long profits when the franc strengthens against the dollar; short profits when it weakens.",
  CAD: "The Canadian dollar against the US dollar (CAD/USD). Long profits when the Canadian dollar strengthens; short profits when it weakens.",
};

/** Where this network reads the price: the Chainlink feed on mainnet, the keeper's mirror of it on practice. */
function feedSource(meta: EngineMarket, chainId: ChainId): { label: string; address: string } | undefined {
  if (chainId !== TESTNET_CHAIN_ID) return { label: "Feed contract", address: meta.mainnetFeed };
  try {
    return { label: "Mirror of the feed", address: addressOf(chainId, meta.testnetMirror) };
  } catch {
    // Not in this build's address book: the row is left out rather than guessed.
    return undefined;
  }
}

export function MarketAbout({ line }: { line: MarketLine }) {
  const network = useNetwork();
  const { color } = useTheme();
  const meta = engineMarket(line.marketId);
  const calendar = useCalendar(line.market.calendarId);
  const now = useNowSec();
  const { risk, book, pv } = line.market;
  const rates = marketRates(line.market);
  const source = meta ? feedSource(meta, network.chainId) : undefined;
  const week = calendar.status === "fresh" || calendar.status === "stale" ? calendar.value : undefined;
  const open = line.status === "OPEN";
  const turn = week ? nextTransition(week, now, !open) : undefined;
  const hours = turn === undefined ? STATUS_LABEL[line.status] : `${open ? "Closes" : "Opens"} ${utcSlotLabel(turn)}`;
  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Max leverage", value: line.maxLeverageX > 0 ? `${line.maxLeverageX}×` : "—" },
    { label: "Fee", value: bpsPct(risk.feeBps) },
    { label: "Spread now", value: bpsPct(pv.spreadBps) },
    { label: "Funding now", value: open ? fundingForMarket(rates) : "Paused" },
    { label: "Hours", value: hours },
    {
      label: "OI long / short",
      value: `${usd(notional(book.longSize, line.price18), 0)} / ${usd(notional(book.shortSize, line.price18), 0)}`,
    },
  ];
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        About {line.name}
      </Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>{MARKET_ABOUT[line.symbol] ?? `${line.name} perpetual.`}</Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.cell} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[TYPE.rowPrice, { color: color.ink }]}
            >
              {s.value}
            </Text>
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
      <Disclosure title="Technical details">
        {meta ? <DetailRow label="Price feed" value={`Chainlink ${meta.feedDescription}`} /> : null}
        {meta ? <DetailRow label="Pair" value={marketPair(meta)} /> : null}
        {source ? (
          <LinkRow
            label={source.label}
            value={shortAddress(source.address)}
            onPress={() => void Linking.openURL(explorerAddressUrl(network.chainId, source.address))}
          />
        ) : null}
        <DetailRow label="Oracle updated" value={ageLabel(line.updatedAt, now)} />
        {meta ? <DetailRow label="Price precision" value={`${meta.priceDecimals} decimals`} /> : null}
        <DetailRow label="Initial margin" value={bpsPct(risk.imBps)} />
        <DetailRow label="Maintenance margin" value={bpsPct(risk.mmBps)} />
        <DetailRow label="Profit cap" value={`${bpsPct(risk.maxProfitBps)} of entry`} />
        <DetailRow label="Borrow, both sides" value={borrowApr(rates)} />
        <DetailRow label="Venue" value={`Senryo · ${network.name}`} />
      </Disclosure>
    </View>
  );
}

function LinkRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Opens the explorer"
      style={({ pressed }) => [styles.link, { opacity: pressed ? PRESSED : 1 }]}
    >
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{label}</Text>
      <Text style={[TYPE.rowAmount, { color: color.link }]}>{value}</Text>
    </Pressable>
  );
}

const PRESSED = 0.6;
/** Two cells per row, so values line up in columns. */
const CELL_SHARE = "47%";

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.lg, columnGap: SPACE.lg },
  cell: { width: CELL_SHARE, gap: SPACE.xxs },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.lg,
    minHeight: SIZE.touch - SPACE.sm,
  },
});
