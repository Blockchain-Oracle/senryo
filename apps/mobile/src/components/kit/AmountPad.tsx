/**
 * An amount, entered (P3 Parlay's stake, P5 Earn's supply and withdraw; the terminal's stake sheet): the figure large,
 * a line under it that names the problem or the limits, optional quick chips (presets, or ¼ ½ ¾ All of a balance),
 * and the kit keypad (21st bankkroll/number-pad #3711). It holds the typed text and reports the value in dollars (e6);
 * the caller owns the rules and the confirm.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { applyKey, Keypad } from "./Keypad";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const CHIP_HEIGHT = SIZE.touch - SPACE.sm;

export const dollarsText = (v: bigint) => formatUnits(v, DOLLAR_DECIMALS, CENTS);

export function AmountPad({
  value,
  onChange,
  chips = [],
  note,
  problem,
  label = "Amount",
}: {
  value: bigint;
  onChange: (next: bigint) => void;
  chips?: readonly { label: string; value: bigint }[];
  /** The quiet line under the figure (limits, what it buys); `problem` replaces it in the warning tone. */
  note?: string;
  problem?: string | null;
  label?: string;
}) {
  const { color } = useTheme();
  const [text, setText] = useState(() => (value > 0n ? dollarsText(value) : ""));
  const set = (next: string) => {
    setText(next);
    const parsed = parseUnits(next === "" ? "0" : next, DOLLAR_DECIMALS);
    onChange(parsed.ok ? parsed.value : 0n);
  };
  return (
    <View style={styles.wrap}>
      <Text
        accessibilityRole="text"
        accessibilityLabel={`${label} ${text === "" ? "empty" : `$${text}`}`}
        style={[TYPE.displayBalance, styles.center, { color: text === "" ? color.text3 : color.ink }]}
      >
        ${text === "" ? "0" : text}
      </Text>
      <Text style={[TYPE.caption, styles.center, { color: problem ? color.down : color.inkMuted }]}>
        {problem ?? note ?? " "}
      </Text>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => {
            const on = c.value === value;
            return (
              <Pressable
                key={c.label}
                onPress={() => {
                  fire("tick");
                  set(dollarsText(c.value));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { backgroundColor: on ? color.ink : color.raised2 }]}
              >
                <Text style={[TYPE.chipLabel, { color: on ? color.ground : color.ink }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Keypad onKey={(k) => set(applyKey(text, k))} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  center: { textAlign: "center" },
  chips: { flexDirection: "row", gap: SPACE.sm },
  chip: {
    flex: 1,
    minHeight: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
