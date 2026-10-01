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
import { fire } from "~/feedback/fire";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ageLabel, STATUS_LABEL } from "./session";
import type { MarketLine } from "./useMarketLine";
import { useNowSec } from "./useNowSec";

const INSTRUMENT: Record<EngineMarket["category"], string> = {
  metal: "Commodity perpetual",
  fx: "FX perpetual",
};

/** 5 bps → "0.05%": a rate in basis points as a percent with two decimals. */
const bpsPct = (bps: bigint) => `${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.cents)}%`;

/** Where this network reads the price: the Chainlink feed on mainnet, the keeper's mirror of it on practice. */
function feedSource(meta: EngineMarket, chainId: ChainId): { label: string; address: string } | undefined {
  if (chainId !== TESTNET_CHAIN_ID) return { label: "Feed contract", address: meta.mainnetFeed };
  try {
    return { label: "Mirror of the mainnet feed", address: addressOf(chainId, meta.testnetMirror) };
  } catch {
    // Not in this build's address book: the row is left out rather than guessed.
    return undefined;
  }
}

/**
 * Market detail's About tab (Fomo F35; direction "Market About tab": instrument type, session, feed / source /
 * freshness, limits, venue): label and value rows in the quiet style, bare on the page. Every value is the market's
 * configuration (`@senryo/config`) or what the engine and the oracle answered in the same read the price came from —
 * a value that isn't known is left out, never estimated.
 */
export function MarketAbout({ line }: { line: MarketLine }) {
  const network = useNetwork();
  const { color } = useTheme();
  const meta = engineMarket(line.marketId);
  const calendar = useCalendar(line.market.calendarId);
  const now = useNowSec();
  const { risk, book, pv } = line.market;
  const source = meta ? feedSource(meta, network.chainId) : undefined;

  // The onchain status decides whether it trades; the calendar only words when that changes next.
  const week = calendar.status === "fresh" || calendar.status === "stale" ? calendar.value : undefined;
  const turn =
    week && line.status === "OPEN"
      ? nextTransition(week, now, false)
      : week && line.status === "CLOSED"
        ? nextTransition(week, now, true)
        : undefined;
  const session =
    turn === undefined
      ? STATUS_LABEL[line.status]
      : `${STATUS_LABEL[line.status]} · ${line.status === "OPEN" ? "closes" : "opens"} ${utcSlotLabel(turn)}`;

  return (
    <View>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, styles.heading, { color: color.ink }]}>
        About {line.name}
      </Text>
      {meta ? <Row label="Instrument" value={INSTRUMENT[meta.category]} /> : null}
      {meta ? <Row label="Pair" value={marketPair(meta)} /> : null}
      <Row label="Session" value={session} />
      <Row label="Venue" value={`Senryo · ${network.name}`} />
      {meta ? <Row label="Price feed" value={`Chainlink ${meta.feedDescription}`} /> : null}
      {source ? (
        <Row
          label={source.label}
          value={shortAddress(source.address)}
          hint="Opens the explorer"
          onPress={() => void Linking.openURL(explorerAddressUrl(network.chainId, source.address))}
        />
      ) : null}
      <Row label="Oracle updated" value={ageLabel(line.updatedAt, now)} />
      {meta ? <Row label="Price precision" value={`${meta.priceDecimals} decimals`} /> : null}
      {line.maxLeverageX > 0 ? <Row label="Max leverage" value={`${line.maxLeverageX}×`} /> : null}
      <Row label="Initial margin" value={bpsPct(risk.imBps)} />
      <Row label="Maintenance margin" value={bpsPct(risk.mmBps)} />
      <Row label="Trading fee" value={`${risk.feeBps} bps (${bpsPct(risk.feeBps)})`} />
      <Row label="Spread now" value={`${pv.spreadBps} bps`} />
      <Row label="Long open interest" value={usd(notional(book.longSize, line.price18), 0)} />
      <Row label="Short open interest" value={usd(notional(book.shortSize, line.price18), 0)} />
    </View>
  );
}

function Row({ label, value, onPress, hint }: { label: string; value: string; onPress?: () => void; hint?: string }) {
  const { color } = useTheme();
  const body = (
    <>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{label}</Text>
      <Text numberOfLines={1} style={[TYPE.rowAmount, styles.value, { color: onPress ? color.link : color.ink }]}>
        {value}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      {...(hint ? { accessibilityHint: hint } : {})}
      style={({ pressed }) => [styles.row, { opacity: pressed ? PRESSED : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  heading: { paddingBottom: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.lg,
    minHeight: SIZE.touch,
  },
  value: { flexShrink: 1, textAlign: "right" },
});
