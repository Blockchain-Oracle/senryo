/**
 * A labelled field of the profile editor (Fomo F17/F18): the label above with an optional counter across from it
 * ("0 / 160"), a filled plate — 52 pt for one line, 112 pt for the bio — and a state line under it. It is the setup
 * step's field (`SetupField`, C09) at form scale: same fill, same hairline that turns to the ring on focus, same
 * tones. `SetupField` itself always takes focus, is single-line and centres its message, so a form of three fields
 * needs this one. The state line keeps `messageLines` of height, so nothing jumps when a message appears.
 */
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export type FieldTone = "quiet" | "good" | "bad";

/** F17: the bio plate is 112 pt tall (224 px at 2 px per pt). */
const MULTILINE_HEIGHT = 112;
const MESSAGE_LINE = TYPE.rowDetail.lineHeight ?? SIZE.skeletonLine;

export function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  max,
  counter = true,
  message,
  tone = "quiet",
  messageLines = 0,
  multiline = false,
  autoFocus = false,
  onFocus,
  input,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  prefix?: string;
  /** The character limit: input stops there. */
  max?: number;
  /** Show the live "12 / 160" across from the label (needs `max`). */
  counter?: boolean;
  /** The state line under the field. */
  message?: string | undefined;
  tone?: FieldTone;
  /** Lines of height the state line always keeps. */
  messageLines?: number;
  multiline?: boolean;
  autoFocus?: boolean;
  /** Called with the field's offset in its scroll content, so the page can bring it above the keyboard. */
  onFocus?: (y: number) => void;
  input?: Pick<TextInputProps, "autoCapitalize" | "keyboardType" | "returnKeyType" | "onSubmitEditing">;
}) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  const y = useRef(0);
  const ink = tone === "good" ? color.up : tone === "bad" ? color.down : color.text3;
  const full = max !== undefined && value.length >= max;
  return (
    <View
      style={styles.wrap}
      onLayout={(event) => {
        y.current = event.nativeEvent.layout.y;
        // A field focused as the page opens is laid out after it takes focus: report its place once it has one.
        if (focused) onFocus?.(y.current);
      }}
    >
      <View style={styles.head}>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{label}</Text>
        {max === undefined || !counter ? null : (
          <Text
            accessibilityLabel={`${value.length} of ${max} characters`}
            style={[TYPE.rowChange, { color: full ? color.warn : color.text3 }]}
          >
            {value.length} / {max}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.plate,
          multiline ? styles.tall : styles.line,
          { backgroundColor: color.card, borderColor: focused ? color.ring : color.border },
        ]}
      >
        {prefix ? <Text style={[TYPE.field, { color: color.text3 }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.text3}
          selectionColor={color.primary}
          autoCorrect={multiline}
          spellCheck={multiline}
          autoFocus={autoFocus}
          multiline={multiline}
          {...(max === undefined ? {} : { maxLength: max })}
          accessibilityLabel={label}
          onFocus={() => {
            setFocused(true);
            onFocus?.(y.current);
          }}
          onBlur={() => setFocused(false)}
          style={[TYPE.field, styles.input, multiline ? styles.inputTall : styles.inputLine, { color: color.ink }]}
          {...input}
        />
      </View>
      {messageLines > 0 || message ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole={tone === "bad" ? "alert" : undefined}
          style={[TYPE.rowDetail, { color: ink, minHeight: messageLines * MESSAGE_LINE }]}
        >
          {message ?? " "}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.md },
  plate: {
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: HAIRLINE_PX,
  },
  line: { alignItems: "center", height: SIZE.inputHeight },
  tall: { alignItems: "flex-start", minHeight: MULTILINE_HEIGHT, paddingVertical: SPACE.md },
  input: { flex: 1, paddingVertical: 0 },
  // lineHeight is dropped: iOS centres a single-line input's text only when the line box is its own.
  inputLine: { height: SIZE.inputHeight, lineHeight: undefined },
  inputTall: { minHeight: MULTILINE_HEIGHT - SPACE.md * 2, textAlignVertical: "top" },
});
