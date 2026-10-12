/**
 * Any stake (the terminal's "…" after its presets, the parlay slip's custom amount): the kit `AmountPad`, checked
 * against the pool's minimum and maximum stake and the balance as it is typed; "Use $7.50" sets it.
 */
import { formatUnits } from "@senryo/core";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AmountPad } from "~/components/kit/AmountPad";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE } from "~/theme";
import { Sheet, useSheetClose } from "./Sheet";
import { SheetHeading } from "./SheetRoute";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

function Body({
  current,
  min,
  max,
  balance,
  per,
  onPick,
}: {
  current: bigint;
  min: bigint;
  max: bigint;
  balance: bigint | undefined;
  per: string;
  onPick: (stake: bigint) => void;
}) {
  const close = useSheetClose();
  const [value, setValue] = useState(current);
  const cap = balance !== undefined && balance < max ? balance : max;
  const problem =
    value === 0n
      ? null
      : value < min
        ? `At least ${usd(min)}`
        : value > max
          ? `At most ${usd(max)} ${per}`
          : balance !== undefined && value > balance
            ? `You have ${usd(balance)}`
            : null;
  const ok = value > 0n && problem === null;
  return (
    <View style={styles.body}>
      <SheetHeading title="Stake" />
      <AmountPad
        label="Stake"
        value={value}
        onChange={setValue}
        note={`${usd(min)} to ${usd(cap)}`}
        problem={problem}
      />
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
  /** What one stake buys, for the limit line ("a call", "a parlay"). */
  per?: string;
  onPick: (stake: bigint) => void;
  onClose: () => void;
}) {
  const { onClose, per = "a call", ...rest } = props;
  return (
    <Sheet onClose={onClose} closeLabel="Close stake">
      <Body {...rest} per={per} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg },
});
