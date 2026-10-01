/**
 * Amount keypad (C39/FT104, Fomo F37): a borderless 3 × 4 grid (1–9, ".", 0, delete) of large Inter figures that fill
 * the ticket's entry region, a `tick` per key, pressed keys on the row-pressed surface. Ported from 21st
 * bankkroll/number-pad (#3711), re-laid out in Fomo's anatomy (S1b.8). Pure input: the ticket owns the amount string
 * and its rules (`applyKey`, unchanged: two decimals, a digit cap, no leading zeros). Distinct from the native
 * keyboard the TP/SL child uses (03-fomo "two input systems").
 */
import { Delete } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, NUMERIC_VARIANT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export type KeypadKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "0" | "del";
const KEYS: readonly KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
const COLUMNS = 3;
/** Whole-dollar digits before the point, and cents after it. */
export const AMOUNT_MAX_WHOLE_DIGITS = 7;
export const AMOUNT_DECIMALS = 2;

/** Next amount text after a key; unchanged when the key would make it invalid. */
export function applyKey(text: string, key: KeypadKey): string {
  if (key === "del") return text.slice(0, -1);
  const [whole = "", frac] = text.split(".");
  if (key === ".") return frac !== undefined ? text : `${whole === "" ? "0" : whole}.`;
  if (frac !== undefined) return frac.length >= AMOUNT_DECIMALS ? text : `${text}${key}`;
  if (whole === "0") return key;
  return whole.length >= AMOUNT_MAX_WHOLE_DIGITS ? text : `${text}${key}`;
}

export function Keypad({ onKey, disabled }: { onKey: (key: KeypadKey) => void; disabled?: boolean }) {
  const { color } = useTheme();
  const rows = Array.from({ length: KEYS.length / COLUMNS }, (_, r) => KEYS.slice(r * COLUMNS, r * COLUMNS + COLUMNS));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.join("")} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => {
                fire("tick");
                onKey(key);
              }}
              accessibilityRole="keyboardkey"
              accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Decimal point" : key}
              style={({ pressed }) => [styles.key, pressed ? { backgroundColor: color.rowPressed } : null]}
            >
              {key === "del" ? (
                <Delete size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
              ) : (
                <Text
                  maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                  style={[TYPE.sheetTitle, styles.digit, { color: color.ink }]}
                >
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, gap: SPACE.xxs },
  row: { flex: 1, flexDirection: "row", gap: SPACE.xxs },
  key: {
    flex: 1,
    minHeight: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
  },
  digit: { fontVariant: NUMERIC_VARIANT },
});
