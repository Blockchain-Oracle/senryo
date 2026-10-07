/**
 * The one large field of a setup step (Fomo F04/F07; C09/C10): a 64 pt filled plate with an optional prefix ("@") and
 * a trailing text action (Paste, Clear), and a reserved line under it for the field's state so nothing jumps when a
 * message appears (C09). An input is one of the few places a hairline is allowed; it turns to the ring colour on focus.
 */
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { fire } from "~/feedback/fire";
import { BUTTON, HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export type FieldTone = "quiet" | "good" | "bad";

export function SetupField({
  value,
  onChangeText,
  placeholder,
  prefix,
  action,
  message,
  tone = "quiet",
  label,
  input,
  onMessagePress,
  messageAccessory,
  variant = "default",
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  prefix?: string;
  /** A text action at the field's trailing edge. */
  action?: { label: string; onPress: () => void };
  /** The state line under the field; the line's height is kept when there is none. */
  message?: string;
  tone?: FieldTone;
  /** The field's accessible name. */
  label: string;
  input?: Pick<TextInputProps, "autoCapitalize" | "maxLength" | "keyboardType" | "returnKeyType" | "onSubmitEditing">;
  /** The state line is an action ("Couldn’t check · Retry"). */
  onMessagePress?: () => void;
  /** Sits after the state line (an ⓘ behind "On hold"). */
  messageAccessory?: ReactNode;
  variant?: "default" | "username";
}) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  const ink = tone === "good" ? color.up : tone === "bad" ? color.down : color.text3;
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.plate,
          variant === "username" ? styles.usernamePlate : null,
          {
            backgroundColor: variant === "username" ? color.input : color.card,
            borderColor: variant === "username" ? color.transparent : focused ? color.ring : color.border,
          },
        ]}
      >
        {prefix ? <Text style={[TYPE.field, { color: color.text3 }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.text3}
          selectionColor={color.primary}
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            variant === "username" ? TYPE.displayPrice : TYPE.field,
            styles.input,
            variant === "username" ? styles.usernameInput : null,
            { color: color.ink },
          ]}
          {...input}
        />
        {action ? (
          <Pressable
            onPress={() => {
              fire("tick");
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={SPACE.md}
          >
            <Text style={[TYPE.buttonCompact, { color: color.text2 }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.line}>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole={onMessagePress ? "button" : tone === "bad" ? "alert" : undefined}
          onPress={onMessagePress}
          suppressHighlighting
          style={[TYPE.rowDetail, styles.message, { color: ink }]}
        >
          {message ?? " "}
        </Text>
        {messageAccessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  plate: {
    flexDirection: "row",
    alignItems: "center",
    // Room between the text and its trailing action, so a long placeholder never reads as one word with "Paste".
    gap: SPACE.md,
    height: SIZE.fieldHeight,
    paddingHorizontal: SPACE.lg,
    borderRadius: BUTTON.radius.md + SPACE.xs,
    borderWidth: HAIRLINE_PX,
  },
  // lineHeight is dropped: iOS centres a single-line input's text only when the line box is its own.
  input: { flex: 1, height: SIZE.fieldHeight, lineHeight: undefined, paddingVertical: 0 },
  usernamePlate: { height: SIZE.fieldHeight + SPACE.xl, borderWidth: 0, borderRadius: BUTTON.radius.md },
  usernameInput: { height: SIZE.fieldHeight + SPACE.xl, textAlign: "center" },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  message: { textAlign: "center" },
});
