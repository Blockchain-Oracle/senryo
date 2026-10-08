/**
 * Any stake (pivot "Call": presets $1 / 5 / 10 / 25 / Max, or the keypad): the amount large over the kit keypad
 * (21st.dev bankkroll/number-pad #3711, the earlier port), checked against the pool's minimum and maximum stake and
 * the balance as it is typed; "Use $7.50" sets it and it is remembered like a preset.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { applyKey, Keypad } from "~/components/kit/Keypad";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

function Body({
  current,
  min,
  max,
  balance,
  onPick,
}: {
  current: bigint;
  min: bigint;
  max: bigint;
  balance: bigint | undefined;
  onPick: (stake: bigint) => void;
}) {
  const { color } = useTheme();
  const close = useSheetClose();
  const [text, setText] = useState(formatUnits(current, DOLLAR_DECIMALS, CENTS));
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const value = parsed.ok ? parsed.value : 0n;
  const cap = balance !== undefined && balance < max ? balance : max;
  const problem =
    value === 0n
      ? null
      : value < min
        ? `At least ${usd(min)}`
        : value > max
          ? `At most ${usd(max)} a call`
          : balance !== undefined && value > balance
            ? `You have ${usd(balance)}`
            : null;
  const ok = value > 0n && problem === null;
  return (
    <View style={styles.body}>
      <SheetHeading title="Stake" body={`${usd(min)} to ${usd(cap)}`} />
      <Text
        accessibilityRole="text"
        accessibilityLabel={`Stake ${text === "" ? "empty" : `$${text}`}`}
        style={[TYPE.displayBalance, styles.amount, { color: text === "" ? color.text3 : color.ink }]}
      >
        ${text === "" ? "0" : text}
      </Text>
      <Text style={[TYPE.caption, styles.center, { color: problem ? color.down : color.inkMuted }]}>
        {problem ?? " "}
      </Text>
      <Keypad onKey={(k) => setText((t) => applyKey(t, k))} />
      <Button
        label={ok ? `Use ${usd(value)}` : "Enter a stake"}
        disabled={!ok}
        onPress={() => {
          fire("confirm");
          close(() => onPick(value));
        }}
      />
    </View>
  );
}

export function StakeSheet(props: {
  current: bigint;
  min: bigint;
  max: bigint;
  balance: bigint | undefined;
  onPick: (stake: bigint) => void;
  onClose: () => void;
}) {
  const { onClose, ...rest } = props;
  return (
    <Sheet onClose={onClose} closeLabel="Close stake">
      <Body {...rest} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg },
  amount: { textAlign: "center" },
  center: { textAlign: "center" },
});
