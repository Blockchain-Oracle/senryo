/**
 * The one checkbox of the terms sheet (Fomo F08; 21st.dev originui checkbox, id 661, ported as a plate): a filled
 * row one step lighter than the sheet, the box at the leading edge (its outline is the unchecked state), and "I agree
 * to the Terms and Privacy" with both names as links. Press 0.985 (a wide row); a `tick` per change.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useGroupFill } from "~/components/kit/Surface";
import { Check } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { BUTTON, HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const ROW_PRESS_SCALE = 0.985;
const BOX = SIZE.icon;
const BOX_CHECK = 16;

export function AgreeRow({
  checked,
  onToggle,
  onTerms,
  onPrivacy,
}: {
  checked: boolean;
  onToggle: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const press = usePressScale(ROW_PRESS_SCALE);
  const link = (label: string, onPress: () => void) => (
    <Text accessibilityRole="link" onPress={onPress} style={[TYPE.bodyStrong, { color: color.link }]}>
      {label}
    </Text>
  );
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onToggle();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="I agree to the Terms of use and the Privacy notice"
        style={[styles.row, { backgroundColor: fill }]}
      >
        <View
          style={[
            styles.box,
            checked
              ? { backgroundColor: color.primary, borderColor: color.primary }
              : { backgroundColor: color.transparent, borderColor: color.text3 },
          ]}
        >
          {checked ? (
            <Check size={BOX_CHECK} strokeWidth={SIZE.iconStroke + 1} color={color.primaryForeground} />
          ) : null}
        </View>
        <Text style={[TYPE.body, styles.flex, { color: color.ink }]}>
          I agree to the {link("Terms", onTerms)} and {link("Privacy", onPrivacy)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: BUTTON.radius.md + SPACE.xs,
  },
  // A checkbox is a control boundary: its outline is the unchecked state.
  box: {
    width: BOX,
    height: BOX,
    borderRadius: SPACE.xs + SPACE.xxs,
    borderWidth: HAIRLINE_PX + HAIRLINE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
});
