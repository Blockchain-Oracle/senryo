/**
 * One feed event (Fomo F15, direction §9): avatar, then name · verb plate · age, the market line, the thesis text
 * hanging off the avatar by its connector, and the engagement line. Bare on the page — no card, no divider; rows are
 * separated by their own height. A thesis opens its thread; a trade opens its trader; the avatar and name always open
 * the trader, the ticker its market.
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
import { Engagement } from "./Engagement";
import { marketOfId, nameOf, timeAgo } from "./format";
import { ThesisMarket, TradeMarket } from "./MarketLine";
import { useOpenPost } from "./navigation";
import { TraderAvatar } from "./TraderAvatar";
import { VerbPlate, verbOf } from "./VerbPlate";

/** A wide row barely moves under the finger (build brief §4). */
const ROW_PRESS_SCALE = 0.985;
/** Rows past this one arrive together: a long page never waits on its own stagger. */
const STAGGER_ROWS = 6;
const AVATAR = SIZE.avatarSm;
/** Half a line of the thesis text: where the connector's turn meets it. */
const TEXT_HALF_LINE = (TYPE.body.lineHeight ?? 0) / 2;

export function FeedRow({ item, index = 0 }: { item: FeedItem; index?: number }) {
  const network = useNetwork();
  const { color } = useTheme();
  const { fontScale } = useWindowDimensions();
  const press = usePressScale(ROW_PRESS_SCALE);
  const openPost = useOpenPost();
  const { actor, post, trade } = item;
  const market = marketOfId(network.chainId, item.marketId, trade?.symbol);
  const verb = verbOf(item);
  const name = nameOf(actor);
  const age = timeAgo(item.at);
  const openTrader = () => {
    fire("tick");
    router.push(watchRoute(actor.address) as Href);
  };
  const open = () => {
    if (!post) return openTrader();
    fire("tick");
    openPost({ id: post.id, author: actor.address });
  };
  // The text sits two lines under the avatar when a market line comes first; the connector ties it back (F15).
  const headLine = (TYPE.rowTitle.lineHeight ?? 0) * fontScale;
  const marketLine = Math.max(SIZE.markInline, (TYPE.rowStrong.lineHeight ?? 0) * fontScale);
  const drop = headLine + marketLine + 2 * SPACE.xs - AVATAR - CONNECTOR.gap;
  const reach = SPACE.md + AVATAR / 2;
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(Math.min(index, STAGGER_ROWS) * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
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
              <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{age}</Text>
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
            {post ? (
              <View style={styles.engagement}>
                <Engagement post={post} replies={post.replies} />
              </View>
            ) : null}
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
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  body: { flex: 1, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  name: { flexShrink: 1 },
  engagement: { paddingTop: SPACE.xs },
});
