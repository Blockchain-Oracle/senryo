/**
 * A thread (F4 step 4; Fomo F13's thesis block and F15's connectors): the thesis or trade post, its replies oldest
 * first, and the reply composer pinned above the keyboard (the head post's reply control focuses it). A post that was
 * deleted, hidden or whose author left this network answers 404 — said plainly, with the way back. Like Fomo's
 * detail pages the bottom zone belongs to the page's own action, so the route hides the dock.
 */
import { socialKeys, useQueryEnv, useThread } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef } from "react";
import { ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { ErrorState, Skeleton, StaleStamp } from "~/components/kit/states";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { isNotFound } from "./format";
import { QuietLine } from "./Quiet";
import { ReplyComposer } from "./ReplyComposer";
import { HeadPost, ReplyRow } from "./ThreadPost";
import { useQueryError } from "./useQueryError";

export function Thread({ id }: { id: string }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useThread(id);
  const key = socialKeys.thread(env.chainId, id);
  const error = useQueryError(key);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const refreshControl = usePullRefresh(refresh);
  const scroll = useRef<ScrollView>(null);
  /** Set when a reply was just sent: the list follows it to the end once it has arrived. */
  const follow = useRef(false);
  const input = useRef<TextInput>(null);
  const keyboard = useAnimatedKeyboard();
  const bottomInset = insets.bottom;
  const lift = useAnimatedStyle(() => ({ paddingBottom: Math.max(bottomInset, keyboard.height.value) }));
  const thread = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <Animated.View style={[styles.fill, { backgroundColor: color.ground }, lift]}>
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={refreshControl}
        onContentSizeChange={() => {
          if (!follow.current) return;
          follow.current = false;
          scroll.current?.scrollToEnd({ animated: true });
        }}
      >
        {reading.status === "unknown" ? <ThreadSkeleton /> : null}
        {reading.status === "failed" ? (
          isNotFound(error) ? (
            <QuietLine text="This post isn’t available" action={{ label: "Go back", onPress: () => router.back() }} />
          ) : (
            <ErrorState diagnosis={reading.error} retry={() => void refresh()} />
          )
        ) : null}
        {reading.status === "stale" ? (
          <StaleStamp at={reading.at} refreshing={reading.refreshing} failed={reading.error !== undefined} />
        ) : null}
        {thread ? (
          <View>
            <HeadPost
              post={thread.post}
              trade={thread.trade}
              replies={thread.post.replies}
              onReply={() => input.current?.focus()}
            />
            {thread.replies.map((reply, i) => (
              <ReplyRow key={reply.id} post={reply} last={i === thread.replies.length - 1} />
            ))}
            {thread.replies.length === 0 ? <QuietLine tight text="No replies yet" /> : null}
            {thread.nextCursor === null ? null : (
              <Text style={[TYPE.meta, styles.more, { color: color.text3 }]}>
                Showing the first {thread.replies.length} replies
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
      {thread ? (
        <ReplyComposer
          inputRef={input}
          thesis={thread.post}
          onPosted={() => {
            follow.current = true;
          }}
        />
      ) : null}
    </Animated.View>
  );
}

const LINE_WIDTHS = ["40%", "55%", "95%", "80%"] as const;

function ThreadSkeleton() {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the thread"
      accessibilityState={{ busy: true }}
      style={styles.skeleton}
    >
      <View style={[styles.disc, { backgroundColor: color.skeleton }]} />
      <View style={styles.lines}>
        {LINE_WIDTHS.map((width) => (
          <Skeleton key={width} width={width} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter, paddingBottom: SPACE.xl, gap: SPACE.md },
  more: { textAlign: "center", paddingTop: SPACE.md },
  skeleton: { flexDirection: "row", gap: SPACE.md },
  disc: { width: SIZE.avatarMd, height: SIZE.avatarMd, borderRadius: RADIUS.pill },
  lines: { flex: 1, gap: SPACE.sm },
});
