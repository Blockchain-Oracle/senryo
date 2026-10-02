/**
 * The rounded search field (Phantom P22's bottom "@username or wallet", Fomo F31's bottom search with Paste): a filled
 * plate with the search glyph, the input, and trailing round tools (Paste, Scan). Ported from 21st.dev
 * santoshvarmaaddala/search-bar (#1645) — the plate and its leading glyph — without its web focus ring.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Search, type SymbolIcon } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { BUTTON, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
  tools,
  input,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  /** Accessible name ("Recipient"). */
  label: string;
  tools?: ReactNode;
  input?: Pick<TextInputProps, "autoFocus" | "onSubmitEditing" | "returnKeyType" | "maxLength">;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.plate, { backgroundColor: color.raised2 }]}>
      <Search size={SIZE.iconSm + SPACE.xs} strokeWidth={SIZE.iconStroke} color={color.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.text3}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={[TYPE.field, styles.input, { color: color.ink }]}
        {...input}
      />
      {tools ? <View style={styles.tools}>{tools}</View> : null}
    </View>
  );
}

/** A 36 pt round tool inside the field (Paste, Scan; D-196 utility circle), 44 pt to the finger. */
export function ToolCircle({ icon: Icon, label, onPress }: { icon: SymbolIcon; label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={SPACE.xs}
      style={({ pressed }) => [styles.tool, { backgroundColor: pressed ? color.rowPressed : color.card }]}
    >
      <Icon size={SIZE.iconSm + SPACE.xxs} strokeWidth={SIZE.iconStroke} color={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tool: {
    width: BUTTON.utility,
    height: BUTTON.utility,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.inputHeight,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.xs,
    borderRadius: BUTTON.radius.md + SPACE.xs,
  },
  input: { flex: 1, paddingVertical: SPACE.sm },
  tools: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
