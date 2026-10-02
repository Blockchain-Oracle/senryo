/**
 * The verbs every post takes (F-D1, Fomo F13/F15; anatomy after 21st.dev ruixen.ui/social-post-card, id 2652, without
 * its card): like with its count, reply with its count, share — and the ⋯ that opens report / mute / block, or
 * delete on your own thesis or reply. A trade row is a post too: its post is made on the first like, reply, report or
 * share (`useTradePost`). The like answers the finger at once and rolls back with a `fail` if the write is refused;
 * a guest's like or ⋯ opens the account invitation (reading and sharing need no account).
 */
import type { FeedItem, Post } from "@senryo/api-client";
import { type PostTarget, useLikeToggle, useTradePost } from "@senryo/query";
import { type Href, router } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CornerDownRight, Ellipsis, Share2 } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { postActionsRoute, ROUTES, tradePostActionsRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { sameAddress, socialErrorCopy } from "./format";
import { HEART_SIZE, LikeGlyph } from "./LikeBurst";
import { useOpenPost } from "./navigation";
import { postLink, shareLink } from "./share-links";
import { useSocialAccount } from "./useSocialAccount";

/** What the verbs act on: a post, or a feed trade row whose post may not exist yet. */
export interface PostSubject {
  kind: Post["kind"];
  postId: string | null;
  /** A trade row's feed id: its post is created on first use. */
  tradeRow: string | undefined;
  author: string;
  likes: number;
  likedByMe: boolean;
  /** Replies in its thread; undefined for a reply (replies are one level deep). */
  replies: number | undefined;
}

export function subjectOfPost(post: Post): PostSubject {
  return {
    kind: post.kind,
    postId: post.id,
    tradeRow: undefined,
    author: post.author.address,
    likes: post.likes,
    likedByMe: post.likedByMe,
    replies: post.kind === "reply" ? undefined : post.replies,
  };
}

/** A feed row's subject: its thesis, or its trade (zeros until the api reports engagement for it). */
export function subjectOfItem(item: FeedItem): PostSubject {
  if (item.post) return subjectOfPost(item.post);
  const e = item.engagement;
  return {
    kind: "trade",
    postId: e?.postId ?? null,
    tradeRow: item.id,
    author: item.actor.address,
    likes: e?.likes ?? 0,
    likedByMe: e?.likedByMe ?? false,
    replies: e?.replies ?? 0,
  };
}

/** The subject's post id, creating a trade row's post first when it has none yet. */
export function useResolvePost(subject: PostSubject): { resolve: () => Promise<string>; busy: boolean } {
  const tradePost = useTradePost();
  return {
    busy: tradePost.isPending,
    resolve: async () => {
      if (subject.postId) return subject.postId;
      if (!subject.tradeRow) throw new Error("nothing to open");
      return (await tradePost.mutateAsync(subject.tradeRow)).id;
    },
  };
}

function targetOf(subject: PostSubject): PostTarget {
  if (subject.postId) return { post: subject.postId };
  return { tradeRow: subject.tradeRow ?? "" };
}

function couldNot(what: string, error: unknown) {
  fire("fail");
  notify({ title: `Couldn’t ${what}`, description: socialErrorCopy(error, "Try again."), tone: "warning" });
}

interface LikeView {
  liked: boolean;
  likes: number;
}

/** The person's own tap, valid while the server's numbers are still the ones it was laid over. */
interface Override extends LikeView {
  overLiked: boolean;
  overLikes: number;
}

export function LikeButton({ subject }: { subject: PostSubject }) {
  const { color } = useTheme();
  const { guest, session } = useSocialAccount();
  const write = useLikeToggle(session);
  const [mine, setMine] = useState<Override>();
  const [burst, setBurst] = useState(0);
  const over = { overLiked: subject.likedByMe, overLikes: subject.likes };
  const held = mine && mine.overLiked === subject.likedByMe && mine.overLikes === subject.likes ? mine : undefined;
  const shown: LikeView = held ?? { liked: subject.likedByMe, likes: subject.likes };
  const toggle = () => {
    fire("tick");
    if (guest || !session) {
      router.push(ROUTES.accountRequired);
      return;
    }
    if (write.isPending) return;
    const next = { liked: !shown.liked, likes: Math.max(0, shown.likes + (shown.liked ? -1 : 1)) };
    if (next.liked) setBurst((b) => b + 1);
    setMine({ ...next, ...over });
    write.mutate(
      { target: targetOf(subject), like: next.liked },
      {
        onSuccess: (state) => setMine({ liked: state.liked, likes: state.likes, ...over }),
        onError: (error) => {
          setMine(undefined);
          couldNot("save that like", error);
        },
      },
    );
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${shown.liked ? "Unlike" : "Like"}, ${shown.likes} ${shown.likes === 1 ? "like" : "likes"}`}
      accessibilityState={{ selected: shown.liked }}
      hitSlop={SPACE.md}
      style={styles.item}
    >
      <LikeGlyph liked={shown.liked} burst={burst} tint={color.text3} />
      <Text style={[TYPE.rowChange, { color: shown.liked ? color.ink : color.text3 }]}>{shown.likes}</Text>
    </Pressable>
  );
}

/** Reply: opens the thread (from inside the thread, `onReply` focuses the composer instead). */
function ReplyButton({ subject, onReply }: { subject: PostSubject; onReply: (() => void) | undefined }) {
  const { color } = useTheme();
  const openPost = useOpenPost();
  const { resolve } = useResolvePost(subject);
  const count = subject.replies ?? 0;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        if (onReply) return onReply();
        resolve().then(
          (id) => openPost({ id, author: subject.author }),
          (error: unknown) => couldNot("open the replies", error),
        );
      }}
      accessibilityRole="button"
      accessibilityLabel={`Reply, ${count} ${count === 1 ? "reply" : "replies"}`}
      hitSlop={SPACE.md}
      style={styles.item}
    >
      <CornerDownRight size={HEART_SIZE} strokeWidth={SIZE.iconStroke} color={color.text3} />
      <Text style={[TYPE.rowChange, { color: color.text3 }]}>{count}</Text>
    </Pressable>
  );
}

function ShareButton({ subject }: { subject: PostSubject }) {
  const { color } = useTheme();
  const network = useNetwork();
  const { resolve } = useResolvePost(subject);
  return (
    <Pressable
      onPress={() =>
        resolve().then(
          (id) => shareLink(postLink(subject.author, network.chainId, id)),
          (error: unknown) => couldNot("make a link", error),
        )
      }
      accessibilityRole="button"
      accessibilityLabel="Share"
      hitSlop={SPACE.md}
      style={styles.item}
    >
      <Share2 size={HEART_SIZE} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </Pressable>
  );
}

/**
 * The ⋯ at a post's top-right: report / mute / block, or delete your own thesis or reply. Your own trade has none:
 * it can't be deleted (it is onchain) and there is nobody to report.
 */
export function MoreButton({ subject }: { subject: PostSubject }) {
  const { color } = useTheme();
  const { guest, address } = useSocialAccount();
  const { resolve } = useResolvePost(subject);
  if (subject.kind === "trade" && sameAddress(subject.author, address)) return null;
  const open = (id: string) =>
    router.push(
      (subject.kind === "trade"
        ? tradePostActionsRoute({ id, author: subject.author })
        : postActionsRoute({ id, author: subject.author, thesis: subject.kind === "thesis" })) as Href,
    );
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        if (guest) {
          router.push(ROUTES.accountRequired);
          return;
        }
        resolve().then(open, (error: unknown) => couldNot("open its actions", error));
      }}
      accessibilityRole="button"
      accessibilityLabel={`More about this ${subject.kind === "reply" ? "reply" : "post"}`}
      hitSlop={SPACE.md}
    >
      <Ellipsis size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </Pressable>
  );
}

/** Like · reply · share, then whatever the row adds at its trailing end (Trade this). A reply has no reply count. */
export function Engagement({
  subject,
  onReply,
  trailing,
}: {
  subject: PostSubject;
  onReply?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.bar}>
      <LikeButton subject={subject} />
      {subject.replies === undefined ? null : <ReplyButton subject={subject} onReply={onReply} />}
      {subject.kind === "reply" ? null : <ShareButton subject={subject} />}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: SPACE.xl, minHeight: SIZE.touch },
  item: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  trailing: { flex: 1, alignItems: "flex-end" },
});
