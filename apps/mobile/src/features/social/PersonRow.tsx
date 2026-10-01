/**
 * One person in a list (Fomo F29/F30; house row anatomy from `MarketRow`): avatar, name over @handle — with a short
 * reason after the handle when the list has one — and whatever the list puts at the trailing edge (a Follow button, a
 * result). Bare on the page, separated by its own height. The row opens the trader; the trailing control acts alone.
 */
import type { SocialIdentity } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { handleOf, nameOf } from "./format";
import { TraderAvatar } from "./TraderAvatar";

/** A wide row barely moves under the finger (build brief §4). */
const ROW_PRESS_SCALE = 0.985;

export function PersonRow({
  person,
  leading,
  note,
  trailing,
}: {
  person: SocialIdentity;
  /** Before the avatar: a rank or a medal. */
  leading?: ReactNode;
  /** After the handle on the second line ("You", why they are suggested). */
  note?: ReactNode;
  trailing?: ReactNode;
}) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const name = nameOf(person);
  // An account with neither a name nor a handle is already shown by its address: no second copy under it.
  const second = person.handle || person.displayName ? handleOf(person) : undefined;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessible={false}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(watchRoute(person.address) as Href);
        }}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        {leading}
        <TraderAvatar avatar={person.avatar} address={person.address} />
        <View style={styles.text} accessible accessibilityRole="button" accessibilityHint="Opens their profile">
          <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
            {name}
          </Text>
          {second || note ? (
            <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {second}
              {second && note ? " · " : null}
              {note}
            </Text>
          ) : null}
        </View>
        {trailing}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
