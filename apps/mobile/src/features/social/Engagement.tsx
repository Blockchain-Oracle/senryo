/**
 * A post's engagement line (Fomo F13/F15: heart + count, reply arrow + count). The like answers the finger at once —
 * the heart fills and the count moves before the server replies — and goes back with a `fail` if the write is refused.
 * A guest's tap opens the account invitation. Only posts can be liked (the api has no likes on fills).
 */
import type { Post } from "@senryo/api-client";
import { useLikeToggle } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { CornerDownRight, Heart } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { socialErrorCopy } from "./format";
import { useSocialAccount } from "./useSocialAccount";

/** Engagement glyphs sit between the 16 pt and 24 pt icon sizes (F15's heart is about 18 pt). */
const GLYPH = 18;
/** The heart swells a little as it fills, then settles. */
const LIKE_POP = 1.2;

interface LikeView {
  liked: boolean;
  likes: number;
}

/** The person's own tap, valid while the server's row is still the one it was laid over. */
interface Override extends LikeView {
  overLiked: boolean;
  overLikes: number;
}

/** The like as shown: the server's row, with the person's own tap laid over it until the server's row moves. */
function useLike(post: Post): LikeView & { toggle: () => void } {
  const { guest, session } = useSocialAccount();
  const write = useLikeToggle(session);
  const [mine, setMine] = useState<Override>();
  const over = { overLiked: post.likedByMe, overLikes: post.likes };
  const held = mine && mine.overLiked === post.likedByMe && mine.overLikes === post.likes ? mine : undefined;
  const shown: LikeView = held ?? { liked: post.likedByMe, likes: post.likes };
  const toggle = () => {
    if (guest || !session) {
      router.push(ROUTES.accountRequired);
      return;
    }
    if (write.isPending) return;
    const next = { liked: !shown.liked, likes: Math.max(0, shown.likes + (shown.liked ? -1 : 1)) };
    setMine({ ...next, ...over });
    write.mutate(
      { target: { post: post.id }, like: next.liked },
      {
        onSuccess: (state) => setMine({ liked: state.liked, likes: state.likes, ...over }),
        onError: (error) => {
          fire("fail");
          setMine(undefined);
          notify({
            title: "Couldn’t save that like",
            description: socialErrorCopy(error, "Try again."),
            tone: "warning",
          });
        },
      },
    );
  };
  return { ...shown, toggle };
}

export function LikeButton({ post }: { post: Post }) {
  const { color } = useTheme();
  const like = useLike(post);
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tint = like.liked ? color.link : color.text3;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        if (!like.liked) {
          scale.value = withSequence(
            withTiming(LIKE_POP, { duration: TIMING.press, easing: EASE }),
            withTiming(1, { duration: TIMING.pressRelease, easing: EASE }),
          );
        }
        like.toggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${like.liked ? "Unlike" : "Like"}, ${like.likes} ${like.likes === 1 ? "like" : "likes"}`}
      accessibilityState={{ selected: like.liked }}
      hitSlop={SPACE.md}
      style={styles.item}
    >
      <Animated.View style={pop}>
        <Heart
          size={GLYPH}
          strokeWidth={SIZE.iconStroke}
          color={tint}
          fill={like.liked ? color.link : color.transparent}
        />
      </Animated.View>
      <Text style={[TYPE.rowChange, { color: like.liked ? color.ink : color.text3 }]}>{like.likes}</Text>
    </Pressable>
  );
}

/** Like and, for a thesis, how many replies its thread holds. */
export function Engagement({ post, replies }: { post: Post; replies?: number | undefined }) {
  const { color } = useTheme();
  return (
    <View style={styles.bar}>
      <LikeButton post={post} />
      {replies === undefined ? null : (
        <View style={styles.item} accessible accessibilityLabel={`${replies} ${replies === 1 ? "reply" : "replies"}`}>
          <CornerDownRight size={GLYPH} strokeWidth={SIZE.iconStroke} color={color.text3} />
          <Text style={[TYPE.rowChange, { color: color.text3 }]}>{replies}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: SPACE.xl },
  item: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
