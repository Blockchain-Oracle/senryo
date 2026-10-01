import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** One decimal field of the TP/SL child (price or percent), with its unit shown as a quiet prefix/suffix. */
export function TriggerInput({
  value,
  placeholder,
  prefix,
  suffix,
  onChange,
  onFocus,
  label,
}: {
  value: string;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  onChange: (text: string) => void;
  onFocus: () => void;
  label: string;
}) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.input, { backgroundColor: color.raised2, borderColor: focused ? color.ring : color.border }]}>
      {prefix ? <Text style={[TYPE.rowAmount, { color: color.text3 }]}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(",", "."))}
        placeholder={placeholder}
        placeholderTextColor={color.text3}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={() => setFocused(false)}
        style={[TYPE.rowAmount, styles.text, { color: color.ink }]}
      />
      {suffix ? <Text style={[TYPE.rowAmount, { color: color.text3 }]}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: SIZE.inputHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    gap: SPACE.xxs,
  },
  text: { flex: 1, paddingVertical: SPACE.xs },
});
