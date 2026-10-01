/**
 * The market line of a feed row (Fomo F15: mark, linked ticker, amount, change in brackets). A thesis names its market
 * with the live oracle price and 24 h change; a trade names what the fill itself did — side, size in the mode's
 * money, the fill price, and the position's net result when the fill closed it. The ticker opens market detail when
 * the market trades on this network. Leverage isn't in the feed's data, so it isn't shown.
 */
import type { FeedTrade } from "@senryo/api-client";
import { engineMarketsOn } from "@senryo/config";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { useMarketLine } from "~/features/markets/useMarketLine";
import { fire } from "~/feedback/fire";
import { arrow, price18, priceDecimalsOf, signedPct, signedUsd, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type MarketRef, SIDE_WORD } from "./format";
import { useOpenMarket } from "./navigation";

function useListed(market: MarketRef): boolean {
  const network = useNetwork();
  return market.engineId !== undefined && engineMarketsOn(network.chainId).some((m) => m.id === market.engineId);
}

/** Mark + ticker; a link to market detail when there is one (F15's dotted underline says so). */
function Ticker({ market, children }: { market: MarketRef; children?: ReactNode }) {
  const { color } = useTheme();
  const listed = useListed(market);
  const openMarket = useOpenMarket();
  const body = (
    <>
      <EntityMark id={market.mark} size={SIZE.markInline} label={market.symbol} decorative ground={color.ground} />
      <Text style={[TYPE.rowStrong, listed ? styles.link : null, { color: color.ink }]}>{market.symbol}</Text>
    </>
  );
  return (
    <View style={styles.line}>
      {listed ? (
        <Pressable
          onPress={() => {
            fire("tick");
            openMarket(market.symbol);
          }}
          accessibilityRole="link"
          accessibilityLabel={`${market.name ?? market.symbol} market`}
          hitSlop={SPACE.sm}
          style={styles.ticker}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.ticker}>{body}</View>
      )}
      {children}
    </View>
  );
}

/** A thesis's market: the ticker with its live price and 24 h change when the market trades here. */
export function ThesisMarket({ market }: { market: MarketRef }) {
  const listed = useListed(market);
  return (
    <Ticker market={market}>
      {listed && market.engineId !== undefined ? <LivePrice engineId={market.engineId} symbol={market.symbol} /> : null}
    </Ticker>
  );
}

function LivePrice({ engineId, symbol }: { engineId: number; symbol: string }) {
  const { color } = useTheme();
  const reading = useMarketLine(engineId, symbol);
  if (reading.status === "unknown" || reading.status === "failed") return null;
  const { price18: price, change24hBps: change } = reading.value;
  return (
    <>
      <Text style={[TYPE.numSm, { color: color.ink }]}>${price18(price, priceDecimalsOf(engineId))}</Text>
      {change === undefined ? null : (
        <Text style={[TYPE.rowChange, { color: change >= 0n ? color.up : color.down }]}>
          ({arrow(change)} {signedPct(change)})
        </Text>
      )}
    </>
  );
}

/** A trade's market: ticker, side, size, and the closed position's net result when this fill ended it. */
export function TradeMarket({ market, trade }: { market: MarketRef; trade: FeedTrade }) {
  const { color } = useTheme();
  const long = trade.side === "LONG";
  const net = trade.positionNetPnl;
  return (
    <View style={styles.block}>
      <Ticker market={market}>
        <Text style={[TYPE.rowChange, { color: long ? color.up : color.down }]}>{SIDE_WORD[trade.side]}</Text>
        <Text style={[TYPE.numSm, { color: color.ink }]}>{usd(trade.notional)}</Text>
        {net === null ? null : (
          <Text style={[TYPE.rowChange, { color: net >= 0n ? color.up : color.down }]}>
            ({arrow(net)} {signedUsd(net)})
          </Text>
        )}
      </Ticker>
      {trade.price === null ? null : (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          at ${price18(trade.price, market.engineId === undefined ? undefined : priceDecimalsOf(market.engineId))}
          {net === null ? "" : " · net after fees and funding"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.xxs },
  line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: SPACE.sm, rowGap: SPACE.xxs },
  ticker: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  link: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
});
