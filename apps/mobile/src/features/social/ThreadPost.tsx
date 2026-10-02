/**
 * The posts of a thread (Fomo F13/F15 anatomy; direction §9): the thesis — author, market with its live price, text,
 * engagement — and its replies hanging off the thesis's avatar by connectors. Replies are one level deep (the api's
 * rule). Each post carries its own overflow: report, mute, block — or delete when it is yours.
 */
import type { Post } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ellipsis } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { postActionsRoute, ROUTES, watchRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CONNECTOR, Elbow, Rail } from "./Connector";
import { Engagement, LikeButton } from "./Engagement";
import { handleOf, marketOfId, nameOf, timeAgo } from "./format";
import { ThesisMarket } from "./MarketLine";
import { TraderAvatar } from "./TraderAvatar";
import { useSocialAccount } from "./useSocialAccount";
import { VerbPlate } from "./VerbPlate";

const THESIS_AVATAR = SIZE.avatarMd;
const REPLY_AVATAR = SIZE.avatarSm;
/** The rail runs down the centre of the thesis's avatar; replies start where the thesis's text does. */
const RAIL_X = THESIS_AVATAR / 2;
const REPLY_INDENT = THESIS_AVATAR + SPACE.md;

function openTrader(address: string) {
  fire("tick");
  router.push(watchRoute(address) as Href);
}

/** The "more" control of a post: opens its actions, or the account invitation for a guest. */
function Overflow({ post, thesis }: { post: Post; thesis: boolean }) {
  const { color } = useTheme();
  const { guest } = useSocialAccount();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(
          (guest
            ? ROUTES.accountRequired
            : postActionsRoute({ id: post.id, author: post.author.address, thesis })) as Href,
        );
      }}
      accessibilityRole="button"
      accessibilityLabel={`More about this ${thesis ? "post" : "reply"}`}
      hitSlop={SPACE.md}
    >
      <Ellipsis size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </Pressable>
  );
}

export function ThesisBlock({ post, replies }: { post: Post; replies: number }) {
  const { color } = useTheme();
  const network = useNetwork();
  const market = marketOfId(network.chainId, post.marketId);
  const name = nameOf(post.author);
  return (
    <View style={styles.thesis}>
      <View>
        <Pressable
          onPress={() => openTrader(post.author.address)}
          accessibilityRole="link"
          accessibilityLabel={`${name}, profile`}
        >
          <TraderAvatar avatar={post.author.avatar} address={post.author.address} size={THESIS_AVATAR} />
        </Pressable>
        {replies > 0 ? <Rail left={RAIL_X} top={THESIS_AVATAR + CONNECTOR.gap} bottom={0} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.who}>
            <View style={styles.nameLine}>
              <Text
                onPress={() => openTrader(post.author.address)}
                numberOfLines={1}
                style={[TYPE.rowTitle, styles.shrink, { color: color.ink }]}
              >
                {name}
              </Text>
              <VerbPlate label="Thesis" tone="thesis" />
            </View>
            <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {handleOf(post.author)} · {timeAgo(post.createdAt)}
            </Text>
          </View>
          <Overflow post={post} thesis />
        </View>
        {market ? <ThesisMarket market={market} /> : null}
        <Text selectable style={[TYPE.body, { color: color.ink }]}>
          {post.text}
        </Text>
        <View style={styles.engagement}>
          <Engagement post={post} replies={replies} />
        </View>
      </View>
    </View>
  );
}

export function ReplyRow({ post, last }: { post: Post; last: boolean }) {
  const { color } = useTheme();
  const name = nameOf(post.author);
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
        <View style={styles.head}>
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
          <Overflow post={post} thesis={false} />
        </View>
        <Text selectable style={[TYPE.body, { color: color.ink }]}>
          {post.text}
        </Text>
        <View style={styles.engagement}>
          <LikeButton post={post} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thesis: { flexDirection: "row", gap: SPACE.md, paddingBottom: SPACE.md },
  reply: { flexDirection: "row", gap: SPACE.md, paddingLeft: REPLY_INDENT, paddingVertical: SPACE.md },
  body: { flex: 1, gap: SPACE.xs },
  head: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
  who: { flex: 1, gap: SPACE.xxs },
  nameLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  engagement: { paddingTop: SPACE.xs, alignItems: "flex-start" },
});
