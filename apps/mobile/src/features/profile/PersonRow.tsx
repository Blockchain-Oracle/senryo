/**
 * One person in a list (Fomo F06/F30; the market row's anatomy, `features/markets/MarketRow`): bare on the page — no
 * card, no divider — with a 48 pt avatar and the name over the @handle. The press plate reaches a little past the
 * text so it reads as a rounded row; rows arrive in a short stagger behind their list. Tapping opens the person.
 */
import { shortAddress } from "@senryo/core";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { BUTTON, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { portrait } from "./portrait";
import { ROW_PRESS_SCALE, Tap } from "./Tap";

/** Only the first screenful staggers; rows loaded later appear in place. */
const STAGGERED_ROWS = 8;

export interface Person {
  address: string;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
}

export function PersonRow({ person, index, onPress }: { person: Person; index: number; onPress: () => void }) {
  const { color } = useTheme();
  const short = shortAddress(person.address);
  const name = person.displayName ?? (person.handle ? `@${person.handle}` : short);
  const second = person.displayName && person.handle ? `@${person.handle}` : name === short ? null : short;
  return (
    <Animated.View
      {...(index < STAGGERED_ROWS
        ? {
            entering: FadeInDown.duration(TIMING.staggerItem)
              .delay(index * TIMING.stagger)
              .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] }),
          }
        : {})}
    >
      <Tap
        block
        scale={ROW_PRESS_SCALE}
        label={second ? `${name}, ${second}` : name}
        hint="Opens this person"
        onPress={onPress}
        style={styles.row}
        pressedStyle={{ backgroundColor: color.card }}
      >
        <Avatar {...portrait(person.avatar, person.address)} size={SIZE.markDetail} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[TYPE.rowTitle, { color: color.ink }]}>
            {name}
          </Text>
          {second ? (
            <Text numberOfLines={1} style={[TYPE.rowDetail, { color: color.text3 }]}>
              {second}
            </Text>
          ) : null}
        </View>
      </Tap>
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
