import type { FeedItem, FeedTrade } from "@senryo/api-client";
import { socialKeys, useFeed, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ReadingView } from "~/components/kit/states";
import { TraderAvatar, traderName } from "~/features/social/TraderAvatar";
import { quantityText } from "~/features/trade/quantity";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ExternalMarketActivity } from "./ExternalMarketActivity";
import { SideBadge } from "./LeverageBadge";
import { QuietLine } from "./QuietLine";
import { ageLabel } from "./session";
import { useNowSec } from "./useNowSec";

const MS_PER_SECOND = 1000;
/** A thesis shows its first lines in the feed; the thread has the rest. */
const THESIS_LINES = 4;
const FEED_SCOPE = "global";

/** The feed and posts name our engine's markets by their indexer id (`ours-0` = market 0), not by symbol. */
const feedMarketId = (marketId: number) => `ours-${marketId}`;

/** What a fill did to the position, in the feed's past tense (F34 "closed", "opened"). */
const FILL_VERB: Record<FeedTrade["fillKind"], string> = {
  OPEN: "opened",
  INCREASE: "added to",
  DECREASE: "reduced",
  CLOSE: "closed",
  LIQUIDATE: "was liquidated on",
  TRIGGER: "closed by TP/SL",
  INVERT: "flipped",
  DELEVERAGE: "was deleveraged on",
};

/**
 * Market detail's Feed tab: verified spot activity with its own venue and instrument label, followed by public
 * Senryo fills and theses from accounts that opted to share on this network. Only community rows open a trader.
 */
/** How a market that isn't ours names and sizes its fills (Perpl: `perpl-1`, its tick, the base asset). */
export interface FeedMarketFormat {
  /** The indexer's market id. */
  id: string;
  priceDecimals: number;
  /** A 1e18 size in the market's own unit ("0.0002 BTC"). */
  size: (size18: bigint) => string;
}

export function MarketFeed({
  marketId,
  name,
  symbol,
  format,
}: {
  marketId: number;
  name: string;
  symbol: string;
  format?: FeedMarketFormat;
}) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const market = format?.id ?? feedMarketId(marketId);
  const feed = useFeed(FEED_SCOPE, market);
  const now = useNowSec();
  const retry = () => void client.resetQueries({ queryKey: socialKeys.feed(env.chainId, FEED_SCOPE, market) });
  const { color } = useTheme();
  return (
    <View style={styles.sections}>
      <ExternalMarketActivity symbol={symbol} />
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Senryo community
      </Text>
      <ReadingView reading={feed.reading} loading="list" loadingLabel="Loading the feed" retry={retry}>
        {(items) =>
          items.length === 0 ? (
            <QuietLine>No public Senryo trades in {name} yet</QuietLine>
          ) : (
            <View>
              {items.map((item) => (
                <FeedRow key={item.id} item={item} marketId={marketId} now={now} format={format} />
              ))}
              {feed.hasMore ? (
                <Button
                  label="Show more"
                  variant="ghost"
                  size="sm"
                  loading={feed.loadingMore}
                  onPress={feed.loadMore}
                  style={styles.more}
                />
              ) : null}
            </View>
          )
        }
      </ReadingView>
    </View>
  );
}

function FeedRow({
  item,
  marketId,
  now,
  format,
}: {
  item: FeedItem;
  marketId: number;
  now: bigint;
  format: FeedMarketFormat | undefined;
}) {
  const { color } = useTheme();
  const who = traderName(item.actor);
  // The api sends ISO times; one it can't parse shows no age rather than a wrong one.
  const atMs = Date.parse(item.at);
  const age = Number.isFinite(atMs) ? ageLabel(BigInt(Math.floor(atMs / MS_PER_SECOND)), now) : undefined;
  const trade = item.trade;
  const verb = trade ? FILL_VERB[trade.fillKind] : "posted";
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(watchRoute(item.actor.address));
      }}
      accessibilityRole="button"
      accessibilityHint="Opens the trader"
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <TraderAvatar trader={item.actor} size={SIZE.avatarSm} />
      <View style={styles.text}>
        <View style={styles.headline}>
          <Text numberOfLines={1} style={[TYPE.rowStrong, styles.shrink, { color: color.ink }]}>
            {who} <Text style={[TYPE.row, { color: color.text2 }]}>{verb}</Text>
          </Text>
          {trade ? <SideBadge side={trade.side} /> : null}
          {age ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{age}</Text> : null}
        </View>
        {trade ? <TradeLine trade={trade} marketId={marketId} format={format} /> : null}
        {item.post ? (
          <>
            <Text numberOfLines={THESIS_LINES} style={[TYPE.body, { color: color.ink }]}>
              {item.post.text}
            </Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>
              {item.post.likes} {item.post.likes === 1 ? "like" : "likes"} · {item.post.replies}{" "}
              {item.post.replies === 1 ? "reply" : "replies"}
            </Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "P$5,800.00 at $1,416.40 (4.1100 oz)", and a closed position's net result after fees, funding and borrow. */
function TradeLine({
  trade,
  marketId,
  format,
}: {
  trade: FeedTrade;
  marketId: number;
  format: FeedMarketFormat | undefined;
}) {
  const { color } = useTheme();
  const decimals = format?.priceDecimals ?? priceDecimalsOf(marketId);
  const size = format ? format.size(trade.size) : quantityText(marketId, trade.size);
  const net = trade.positionNetPnl;
  return (
    <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
      <Text style={[TYPE.rowChange, { color: color.ink }]}>{usd(trade.notional)}</Text>
      {trade.price === null ? "" : ` at $${price18(trade.price, decimals)}`} ({size})
      {net === null ? null : (
        <Text style={[TYPE.rowChange, { color: net >= 0n ? color.up : color.down }]}> · net {signedUsd(net)}</Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  sections: { gap: SPACE.md },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xs },
  headline: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  shrink: { flexShrink: 1 },
  more: { marginTop: SPACE.sm },
});
