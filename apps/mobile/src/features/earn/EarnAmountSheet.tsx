/**
 * Supply or withdraw by keypad (P5, D-325; Codex's keypad sheet, 21st Number Pad #3711 via the kit's `AmountPad`): the
 * amount large, what's in reach under it (your wallet's dollars, or what you can withdraw), ¼ ½ ¾ All of that, the
 * keypad, about what it buys or pays at today's share price, when it settles, the risk in one sentence, and a pinned
 * confirm. A guest types freely; their confirm is the passkey step (value first, sign last).
 */
import type { EarnView } from "@senryo/api-client";
import { EARN_RISK, estimateLine } from "@senryo/calls";
import { usd } from "@senryo/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AmountPad } from "~/components/kit/AmountPad";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SPACE, TYPE, useTheme } from "~/theme";

const QUARTERS = [
  { label: "¼", num: 1n, den: 4n },
  { label: "½", num: 1n, den: 2n },
  { label: "¾", num: 3n, den: 4n },
  { label: "All", num: 1n, den: 1n },
] as const;

export type EarnSide = "supply" | "withdraw";

interface Props {
  side: EarnSide;
  /** What's in reach: the wallet's dollars to supply, or the value you can withdraw; undefined for a guest. */
  max: bigint | undefined;
  pool: NonNullable<EarnView["pool"]>;
  next: string;
  signedIn: boolean;
  onConfirm: (amount: bigint, all: boolean) => void;
}

function Body(p: Props) {
  const { color } = useTheme();
  const close = useSheetClose();
  const [value, setValue] = useState(0n);
  const supply = p.side === "supply";
  const chips =
    p.max !== undefined && p.max > 0n
      ? QUARTERS.map((q) => ({ label: q.label, value: ((p.max as bigint) * q.num) / q.den }))
      : [];
  const problem = p.max !== undefined && value > p.max ? `You have ${usd(p.max)}` : null;
  const note =
    p.max === undefined
      ? supply
        ? "Sign in when you confirm"
        : "Nothing supplied to withdraw yet"
      : supply
        ? `${usd(p.max)} in your wallet`
        : `${usd(p.max)} you can withdraw`;
  const ready = value > 0n && problem === null;
  return (
    <View style={styles.body}>
      <SheetHeading title={supply ? "Supply" : "Withdraw"} />
      <AmountPad
        label={supply ? "Dollars to supply" : "Dollars to withdraw"}
        value={value}
        onChange={setValue}
        chips={chips}
        note={note}
        problem={problem}
      />
      <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>
        {estimateLine(p.side, value, p.pool)} · {p.next}
      </Text>
      <Text style={[TYPE.caption, styles.center, { color: color.inkMuted }]}>{EARN_RISK}</Text>
      <Button
        label={
          !ready
            ? "Enter an amount"
            : !p.signedIn
              ? `${supply ? "Supply" : "Withdraw"} ${usd(value)} · sign in`
              : `${supply ? "Supply" : "Withdraw"} ${usd(value)} at the next hour`
        }
        disabled={!ready}
        onPress={() => close(() => p.onConfirm(value, p.max !== undefined && value === p.max))}
      />
    </View>
  );
}

export function EarnAmountSheet({ onClose, ...props }: Props & { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} closeLabel={props.side === "supply" ? "Close supply" : "Close withdraw"}>
      <Body {...props} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  center: { textAlign: "center" },
});
