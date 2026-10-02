/**
 * The search field (Fomo F31; behaviour ported from 21st.dev arunachalam/expandable-search-bar, id 7904, with the
 * focus-to-expand of moumensoliman/expanding-search-dock, id 10571 — Framer Motion on the web): a filled pill floating
 * low on the page, narrower than the dock at rest (F31 measures 44 pt in from each edge), that springs out to the
 * dock's width when focused (stiffness 260, damping 26 — the source's spring) and back when it is left empty. A search
 * glyph leads; "Paste" sits inside while it is empty, and a clear control scales in once there is text. It rides
 * above the keyboard. F31 is the one place the reference uses a full pill, so this field does too.
 */
import { SEARCH_QUERY_MAX_CHARS } from "@senryo/api-client";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  ZoomIn,
} from "react-native-reanimated";
import { Search, X } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { readClipboard } from "~/lib/clipboard";
import { DOCK, RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

/** The field's height: the app's input height (F31 measures 49 pt). */
export const SEARCH_FIELD_HEIGHT = SIZE.inputHeight;
/** At rest the field sits this much further in than the dock on each side (F31: 44 pt vs the dock's edge). */
const REST_EXTRA_INSET = 32;
/** The source's spring (expandable-search-bar: stiffness 260, damping 26). */
const EXPAND_SPRING = { stiffness: 260, damping: 26 } as const;

export function SearchField({
  value,
  onChange,
  bottom,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Distance from the screen's bottom edge at rest (the dock's footprint). */
  bottom: number;
  placeholder: string;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const [focused, setFocused] = useState(false);
  const open = focused || value !== "";
  const expand = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    expand.value = reduce ? (open ? 1 : 0) : withSpring(open ? 1 : 0, EXPAND_SPRING);
  }, [open, reduce, expand]);
  const frame = useAnimatedStyle(() => {
    const side = DOCK.inset + REST_EXTRA_INSET * (1 - expand.value);
    return {
      left: side,
      right: side,
      transform: [{ translateY: -Math.max(0, keyboard.height.value + SPACE.sm - bottom) }],
    };
  });
  const paste = async () => {
    const text = (await readClipboard()).trim();
    if (text) onChange(text.slice(0, SEARCH_QUERY_MAX_CHARS));
  };
  return (
    <Animated.View style={[styles.wrap, { bottom }, frame]}>
      <View style={[styles.field, { backgroundColor: color.raised2 }]}>
        <Search size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.text3}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={SEARCH_QUERY_MAX_CHARS}
          accessibilityLabel={placeholder}
          selectionColor={color.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[TYPE.body, styles.input, { color: color.ink }]}
        />
        {value === "" ? (
          <FieldControl label="Paste" onPress={() => void paste().catch(() => undefined)}>
            <Text style={[TYPE.modeLabel, { color: color.ink }]}>Paste</Text>
          </FieldControl>
        ) : (
          <Animated.View {...(reduce ? {} : { entering: ZoomIn.duration(TIMING.press) })}>
            <FieldControl label="Clear search" onPress={() => onChange("")}>
              <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </FieldControl>
          </Animated.View>
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
  wrap: { position: "absolute" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    height: SEARCH_FIELD_HEIGHT,
    paddingLeft: SPACE.lg,
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
