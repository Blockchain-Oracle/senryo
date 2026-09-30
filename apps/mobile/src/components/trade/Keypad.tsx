/**
 * Amount keypad — RN port of 21st bankkroll/number-pad (#3711), D2: a 3 × 4 mono grid (1–9, ".", 0, delete) of
 * hairline keys, `tick` per key (F10). Pure input: the ticket owns the amount string and its rules
 * (`applyKey`: two decimals, a digit cap, no leading zeros).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

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
              style={({ pressed }) => [
                styles.key,
                { borderColor: color.hairline, backgroundColor: pressed ? color.muted : color.ground },
              ]}
            >
              <Text style={[TYPE.numMd, { color: color.ink }]}>{key === "del" ? "⌫" : key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.xs },
  row: { flexDirection: "row", gap: SPACE.xs },
  key: {
    flex: 1,
    minHeight: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
});
