import type { FeedItem, FeedTrade } from "@senryo/api-client";
import { DECIMALS, formatUnits } from "@senryo/core";
import { socialKeys, useFeed, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ReadingView } from "~/components/kit/states";
import { TraderAvatar, traderName } from "~/features/social/TraderAvatar";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { SideBadge } from "./LeverageBadge";
import { QuietLine } from "./QuietLine";
import { ageLabel } from "./session";
import { useNowSec } from "./useNowSec";

const MS_PER_SECOND = 1000;
/** A fill's size is shown to four decimals of the base unit, as the ticket shows quantity. */
const SIZE_DECIMALS = 4;
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
 * Market detail's Feed tab (Fomo F34; direction "Market Feed tab": trade and thesis events for this market): public
 * fills and theses from accounts that share their trades on this network, newest first — who, what they did, the side,
 * how long ago; then the size in this network's money at the fill price. A closed position adds its net result.
 * Nothing is listed that the api did not return; an empty feed is one quiet line. A row opens the trader.
 */
export function MarketFeed({ marketId, name }: { marketId: number; name: string }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const market = feedMarketId(marketId);
  const feed = useFeed(FEED_SCOPE, market);
  const now = useNowSec();
  const retry = () => void client.resetQueries({ queryKey: socialKeys.feed(env.chainId, FEED_SCOPE, market) });
  return (
    <ReadingView reading={feed.reading} loading="list" loadingLabel="Loading the feed" retry={retry}>
      {(items) =>
        items.length === 0 ? (
          <QuietLine>No public trades in {name} yet</QuietLine>
        ) : (
          <View>
            {items.map((item) => (
              <FeedRow key={item.id} item={item} decimals={priceDecimalsOf(marketId)} now={now} />
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
  );
}

/** `decimals` is this market's display precision for the fill price. */
function FeedRow({ item, decimals, now }: { item: FeedItem; decimals: number; now: bigint }) {
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
        {trade ? <TradeLine trade={trade} decimals={decimals} /> : null}
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

/** "P$5,800.00 at $1,416.40 (4.1100 XAU)", and a closed position's net result after fees, funding and borrow. */
function TradeLine({ trade, decimals }: { trade: FeedTrade; decimals: number }) {
  const { color } = useTheme();
  const net = trade.positionNetPnl;
  return (
    <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
      <Text style={[TYPE.rowChange, { color: color.ink }]}>{usd(trade.notional)}</Text>
      {trade.price === null ? "" : ` at $${price18(trade.price, decimals)}`} (
      {formatUnits(trade.size, DECIMALS.e18, SIZE_DECIMALS)} {trade.symbol})
      {net === null ? null : (
        <Text style={[TYPE.rowChange, { color: net >= 0n ? color.up : color.down }]}> · net {signedUsd(net)}</Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
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
