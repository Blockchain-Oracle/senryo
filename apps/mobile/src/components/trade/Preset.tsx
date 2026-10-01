import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { BUTTON, CONTROL_FONT_SCALE, DISABLED_OPACITY, SIZE, TYPE, useTheme } from "~/theme";

/**
 * An amount preset (F37's $10 / $50 / $100 row, P20's 25% / 50% / Sell all): a borderless filled plate that shrinks
 * under the finger. It sets an amount and holds no selection, so none of a row reads as chosen.
 */
export function Preset({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={[styles.slot, press.style]}>
      <Pressable
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.plate,
          { backgroundColor: pressed ? color.rowPressed : color.raised2 },
          disabled ? { opacity: DISABLED_OPACITY } : null,
        ]}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: color.ink }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  plate: { minHeight: SIZE.touch, borderRadius: BUTTON.radius.sm, alignItems: "center", justifyContent: "center" },
});
