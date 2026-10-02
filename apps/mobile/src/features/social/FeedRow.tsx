/**
 * One feed event (Fomo F15, F4): a 40 pt avatar; name · verb tag · age with the ⋯ at the far edge; the position chip
 * (mark, ticker, side, size, coloured result on a close) or a thesis's market; the thesis text hanging off the avatar
 * by its connector; then like · reply · share, and Trade this on a trade whose position is still open. Bare on the
 * page — no card, no divider. Taps (F-D2): a trade row opens its market, a thesis its thread; the avatar and name
 * open the trader; the ticker its market.
 */
import type { FeedItem } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { CONNECTOR, Elbow } from "./Connector";
import { Engagement, MoreButton, subjectOfItem } from "./Engagement";
import { marketOfId, nameOf, timeAgo } from "./format";
import { ThesisMarket, TradeMarket } from "./MarketLine";
import { useOpenMarket, useOpenPost } from "./navigation";
import { TraderAvatar } from "./TraderAvatar";
import { TradeThisButton, tradeIsOpen, useTradable } from "./trade-this";
import { VerbPlate, verbOf } from "./VerbPlate";

/** A wide row barely moves under the finger (build brief §4). */
const ROW_PRESS_SCALE = 0.985;
/** Rows past this one arrive together: a long page never waits on its own stagger. */
const STAGGER_ROWS = 6;
/** F15 measures the feed avatar at 40 pt. */
const AVATAR = SIZE.avatarMd;
/** Half a line of the thesis text: where the connector's turn meets it. */
const TEXT_HALF_LINE = (TYPE.body.lineHeight ?? 0) / 2;

export function FeedRow({ item, index = 0, stagger = true }: { item: FeedItem; index?: number; stagger?: boolean }) {
  const network = useNetwork();
  const { color } = useTheme();
  const { fontScale } = useWindowDimensions();
  const press = usePressScale(ROW_PRESS_SCALE);
  const openPost = useOpenPost();
  const openMarket = useOpenMarket();
  const { actor, post, trade } = item;
  const market = marketOfId(network.chainId, item.marketId, trade?.symbol);
  const tradable = useTradable(market);
  const subject = subjectOfItem(item);
  const verb = verbOf(item);
  const name = nameOf(actor);
  const openTrader = () => {
    fire("tick");
    router.push(watchRoute(actor.address) as Href);
  };
  const open = () => {
    if (post) {
      fire("tick");
      openPost({ id: post.id, author: actor.address });
      return;
    }
    if (market && tradable) {
      fire("tick");
      openMarket(market.symbol);
      return;
    }
    openTrader();
  };
  // The text sits two lines under the avatar when a market line comes first; the connector ties it back (F15).
  const headLine = (TYPE.rowTitle.lineHeight ?? 0) * fontScale;
  const marketLine = Math.max(SIZE.markInline, (TYPE.rowStrong.lineHeight ?? 0) * fontScale);
  const drop = headLine + marketLine + 2 * SPACE.xs - AVATAR - CONNECTOR.gap;
  const reach = SPACE.md + AVATAR / 2;
  const entering = stagger
    ? FadeInDown.duration(TIMING.staggerItem)
        .delay(Math.min(index, STAGGER_ROWS) * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })
    : undefined;
  return (
    <Animated.View {...(entering ? { entering } : {})}>
      <Animated.View style={press.style}>
        <Pressable
          accessible={false}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={open}
          style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
        >
          <Pressable
            onPress={openTrader}
            accessibilityRole="link"
            accessibilityLabel={`${name}, profile`}
            hitSlop={SPACE.sm}
          >
            <TraderAvatar avatar={actor.avatar} address={actor.address} size={AVATAR} />
          </Pressable>
          <View style={styles.body}>
            <View style={styles.head}>
              <Text onPress={openTrader} numberOfLines={1} style={[TYPE.rowTitle, styles.name, { color: color.ink }]}>
                {name}
              </Text>
              <VerbPlate label={verb.label} tone={verb.tone} />
              <Text style={[TYPE.rowDetail, styles.age, { color: color.text3 }]}>{timeAgo(item.at)}</Text>
              <MoreButton subject={subject} />
            </View>
            {market && trade ? (
              <TradeMarket market={market} trade={trade} />
            ) : market ? (
              <ThesisMarket market={market} />
            ) : null}
            {post ? (
              <View>
                {market ? (
                  <Elbow left={-reach} top={-drop} width={reach - CONNECTOR.gap} height={drop + TEXT_HALF_LINE} />
                ) : null}
                <Text
                  accessibilityRole="button"
                  accessibilityHint="Opens the thread"
                  style={[TYPE.body, { color: color.ink }]}
                >
                  {post.text}
                </Text>
              </View>
            ) : null}
            <Engagement
              subject={subject}
              trailing={
                trade && market && tradable && tradeIsOpen(trade) ? (
                  <TradeThisButton symbol={market.symbol} side={trade.side === "LONG" ? "long" : "short"} />
                ) : undefined
              }
            />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    paddingTop: SPACE.md,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  body: { flex: 1, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  name: { flexShrink: 1 },
  age: { flex: 1 },
});
