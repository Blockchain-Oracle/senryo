/**
 * The portrait picker (F17's avatar pencil, adapted): the twelve authored portraits in one scrolling row. The one in
 * use carries a ring — the one place a disc has an edge, because it marks a choice — and a tap selects with a tick and
 * a press shrink. An account that never chose shows its stable default as selected; picking that same portrait sends
 * nothing. The row opens scrolled so the portrait in use is in view.
 */
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { AVATAR_IDS, Avatar, defaultAvatar } from "~/components/identity/Avatar";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, useTheme } from "~/theme";

/** The ring sits this far outside the disc and is this thick. */
const RING_GAP = 3;
const RING = 2;
const DISC = SIZE.avatarLg;
const PICK_PRESS_SCALE = 0.92;

/** Portrait names for VoiceOver, from the authored ids ("avatar-07-buns" → "Portrait 7, buns"). */
function spoken(id: string): string {
  const [, number, ...words] = id.split("-");
  return `Portrait ${Number(number)}, ${words.join(" ")}`;
}

export function AvatarPicker({
  value,
  address,
  onChange,
}: {
  /** The chosen portrait id, or null for the account's default. */
  value: string | null;
  address: string;
  onChange: (id: string) => void;
}) {
  const current = value ?? defaultAvatar(address);
  const row = useRef<ScrollView>(null);
  const placed = useRef(false);
  return (
    <ScrollView
      ref={row}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Profile picture"
    >
      {AVATAR_IDS.map((id) => (
        <Pick
          key={id}
          id={id}
          selected={id === current}
          onPress={() => onChange(id)}
          onPlaced={(x) => {
            if (placed.current || id !== current) return;
            placed.current = true;
            row.current?.scrollTo({ x: Math.max(0, x - SPACE.lg), animated: false });
          }}
        />
      ))}
    </ScrollView>
  );
}

function Pick({
  id,
  selected,
  onPress,
  onPlaced,
}: {
  id: string;
  selected: boolean;
  onPress: () => void;
  /** Where this portrait sits in the row (pt from its start). */
  onPlaced: (x: number) => void;
}) {
  const { color } = useTheme();
  const press = usePressScale(PICK_PRESS_SCALE);
  return (
    <Animated.View style={press.style} onLayout={(e) => onPlaced(e.nativeEvent.layout.x)}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          if (selected) return;
          fire("tick");
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={spoken(id)}
        style={[styles.ring, { borderColor: selected ? color.ring : color.transparent }]}
      >
        <View>
          <Avatar avatar={id} size={DISC} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.sm, paddingVertical: SPACE.xs },
  ring: { padding: RING_GAP, borderWidth: RING, borderRadius: RADIUS.pill },
});
