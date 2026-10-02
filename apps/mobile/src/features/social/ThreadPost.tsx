/**
 * The posts of a thread (Fomo F13/F15 anatomy; F4 step 4): the head post — a thesis (author, market with its live
 * price, text) or a trade post (author, verb tag, the position chip, Trade this while the position is open) — with
 * like · reply · share, and its replies hanging off the head avatar by connectors. Replies are one level deep (the
 * api's rule). Each post carries its own ⋯: report, mute, block — or delete when it is your thesis or reply.
 */
import type { FeedTrade, Post } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CONNECTOR, Elbow, Rail } from "./Connector";
import { Engagement, LikeButton, MoreButton, subjectOfPost } from "./Engagement";
import { handleOf, marketOfId, nameOf, timeAgo } from "./format";
import { ThesisMarket, TradeMarket } from "./MarketLine";
import { TraderAvatar } from "./TraderAvatar";
import { TradeThisButton, tradeIsOpen, useTradable } from "./trade-this";
import { VerbPlate, verbOf } from "./VerbPlate";

const HEAD_AVATAR = SIZE.avatarMd;
const REPLY_AVATAR = SIZE.avatarSm;
/** The rail runs down the centre of the head avatar; replies start where the head's text does. */
const RAIL_X = HEAD_AVATAR / 2;
const REPLY_INDENT = HEAD_AVATAR + SPACE.md;

function openTrader(address: string) {
  fire("tick");
  router.push(watchRoute(address) as Href);
}

/** The thread's own post: a thesis, or a trade post with its trade. `onReply` focuses the composer. */
export function HeadPost({
  post,
  trade,
  replies,
  onReply,
}: {
  post: Post;
  trade: FeedTrade | null;
  replies: number;
  onReply: () => void;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const market = marketOfId(network.chainId, post.marketId, trade?.symbol);
  const tradable = useTradable(market);
  const name = nameOf(post.author);
  const verb = trade ? verbOf({ kind: "position", trade }) : { label: "Thesis", tone: "thesis" as const };
  const subject = { ...subjectOfPost(post), replies };
  return (
    <View style={styles.head}>
      <View>
        <Pressable
          onPress={() => openTrader(post.author.address)}
          accessibilityRole="link"
          accessibilityLabel={`${name}, profile`}
        >
          <TraderAvatar avatar={post.author.avatar} address={post.author.address} size={HEAD_AVATAR} />
        </Pressable>
        {replies > 0 ? <Rail left={RAIL_X} top={HEAD_AVATAR + CONNECTOR.gap} bottom={0} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.who}>
            <View style={styles.nameLine}>
              <Text
                onPress={() => openTrader(post.author.address)}
                numberOfLines={1}
                style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}
              >
                {name}
              </Text>
              <VerbPlate label={verb.label} tone={verb.tone} />
            </View>
            <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {handleOf(post.author)} · {timeAgo(post.createdAt)}
            </Text>
          </View>
          <MoreButton subject={subject} />
        </View>
        {market && trade ? <TradeMarket market={market} trade={trade} /> : null}
        {market && !trade ? <ThesisMarket market={market} /> : null}
        {post.text ? (
          <Text selectable style={[TYPE.body, { color: color.ink }]}>
            {post.text}
          </Text>
        ) : null}
        <Engagement
          subject={subject}
          onReply={onReply}
          trailing={
            trade && market && tradable && tradeIsOpen(trade) ? (
              <TradeThisButton symbol={market.symbol} side={trade.side === "LONG" ? "long" : "short"} />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}

export function ReplyRow({ post, last }: { post: Post; last: boolean }) {
  const { color } = useTheme();
  const name = nameOf(post.author);
  const subject = subjectOfPost(post);
  return (
    <View style={styles.reply}>
      {last ? null : <Rail left={RAIL_X} top={0} bottom={0} />}
      <Elbow left={RAIL_X} top={0} width={REPLY_INDENT - RAIL_X - CONNECTOR.gap} height={SPACE.md + REPLY_AVATAR / 2} />
      <Pressable
        onPress={() => openTrader(post.author.address)}
        accessibilityRole="link"
        accessibilityLabel={`${name}, profile`}
      >
        <TraderAvatar avatar={post.author.avatar} address={post.author.address} size={REPLY_AVATAR} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={[styles.nameLine, styles.grow]}>
            <Text
              onPress={() => openTrader(post.author.address)}
              numberOfLines={1}
              style={[TYPE.rowStrong, styles.shrink, { color: color.ink }]}
            >
              {name}
            </Text>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{timeAgo(post.createdAt)}</Text>
          </View>
          <MoreButton subject={subject} />
        </View>
        <Text selectable style={[TYPE.body, { color: color.ink }]}>
          {post.text}
        </Text>
        <View style={styles.likes}>
          <LikeButton subject={subject} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: SPACE.md, paddingBottom: SPACE.md },
  reply: { flexDirection: "row", gap: SPACE.md, paddingLeft: REPLY_INDENT, paddingVertical: SPACE.md },
  body: { flex: 1, gap: SPACE.xs },
  top: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
  who: { flex: 1, gap: SPACE.xxs },
  nameLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  likes: { paddingTop: SPACE.xs, alignItems: "flex-start" },
});
