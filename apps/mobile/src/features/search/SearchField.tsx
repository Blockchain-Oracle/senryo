import { SEARCH_QUERY_MAX_CHARS } from "@senryo/api-client";
import * as Clipboard from "expo-clipboard";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { countingPrompts } from "~/lib/account/system-prompt";
import { DOCK, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The field's height: the app's input height (F31 measures 49 pt). */
export const SEARCH_FIELD_HEIGHT = SIZE.inputHeight;

/** iOS asks before a paste; counted as the app's own prompt, the privacy plate stays down behind it. */
const clipboard = countingPrompts({ read: () => Clipboard.getStringAsync() });

/**
 * The search field (Fomo F31): a pill-shaped filled field floating low on the page — above the dock, and above the
 * keyboard once it is up — with "Paste" inside it while it is empty and a clear control once there is text. It lines
 * up with the dock row's edges. F31 is the one place the reference uses a full pill, so this field does too.
 */
export function SearchField({
  value,
  onChange,
  bottom,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Distance from the screen's bottom edge at rest (the dock's footprint). */
  bottom: number;
}) {
  const { color } = useTheme();
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.height.value + SPACE.sm - bottom) }],
  }));
  const paste = async () => {
    const text = (await clipboard.read()).trim();
    if (text) onChange(text.slice(0, SEARCH_QUERY_MAX_CHARS));
  };
  return (
    <Animated.View style={[styles.wrap, { bottom }, lift]}>
      <View style={[styles.field, { backgroundColor: color.raised2 }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search markets and traders"
          placeholderTextColor={color.text3}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={SEARCH_QUERY_MAX_CHARS}
          accessibilityLabel="Search markets and traders"
          selectionColor={color.primary}
          style={[TYPE.body, styles.input, { color: color.ink }]}
        />
        {value === "" ? (
          <FieldControl label="Paste" onPress={() => void paste().catch(() => undefined)}>
            <Text style={[TYPE.modeLabel, { color: color.ink }]}>Paste</Text>
          </FieldControl>
        ) : (
          <FieldControl label="Clear search" onPress={() => onChange("")}>
            <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </FieldControl>
        )}
      </View>
    </Animated.View>
  );
}

/** The control inside the field's right end (F31's "Paste"): a small darker pill that shrinks under the finger. */
function FieldControl({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={(SIZE.touch - SIZE.chipHeight) / 2}
        style={[styles.control, { backgroundColor: color.card }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: DOCK.inset, right: DOCK.inset },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    height: SEARCH_FIELD_HEIGHT,
    paddingLeft: SPACE.lgPlus,
    paddingRight: SPACE.sm + SPACE.xxs,
    borderRadius: RADIUS.pill,
  },
  input: { flex: 1, paddingVertical: 0 },
  control: {
    height: SIZE.chipHeight,
    minWidth: SIZE.chipHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
