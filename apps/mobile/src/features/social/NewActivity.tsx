/**
 * The "New activity" pill (Fomo F15, C27): shown once the socket reports a feed row newer than the first one loaded.
 * It sits at the end of the audience chips, pinned under the bar, so it is reachable from anywhere in the list and
 * nothing moves when it appears. A tap reloads the feed from the top.
 */
import type { FeedScope } from "@senryo/api-client";
import { useFeed, useFeedActivity } from "@senryo/query";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowUp } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { BUTTON, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

/** Hit area beyond the 34 pt plate so the target reaches 44 pt. */
const SLOP = (SIZE.touch - SIZE.chipRowHeight) / 2;

export function NewActivity({ scope }: { scope: FeedScope }) {
  const { color } = useTheme();
  const press = usePressScale();
  const feed = useFeed(scope);
  const loaded = feed.reading.status === "fresh" || feed.reading.status === "stale" ? feed.reading.value : undefined;
  const activity = useFeedActivity(loaded?.[0]?.id, scope);
  // Nothing to compare against until the feed itself has answered.
  if (!activity.hasNew || !loaded) return null;
  return (
    <Animated.View entering={FadeIn.duration(TIMING.selection)} exiting={FadeOut.duration(TIMING.press)}>
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            void activity.show();
          }}
          accessibilityRole="button"
          accessibilityLabel="New activity. Show the latest"
          hitSlop={{ top: SLOP, bottom: SLOP }}
          style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? color.primaryPressed : color.primary }]}
        >
          <ArrowUp size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.primaryForeground} />
          <Text style={[TYPE.chipCategory, { color: color.primaryForeground }]}>New activity</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.chipRowHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
  },
});
