/**
 * Close part of a position on the phone (Codex direction 11 §3: hold CLOSE): 25, 50 or 75 % or all of it, each saying
 * about what it returns now — a call's share of its bid, a ride's share of its close value. The close itself takes
 * the live price within its limit.
 */
import { dollars } from "@senryo/calls";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { PART_PERCENTS } from "./constants";

const HUNDRED = 100n;

function Rows({
  title,
  amountAt,
  onPick,
}: {
  title: string;
  amountAt: (percent: bigint) => bigint | null;
  onPick: (percent: bigint) => void;
}) {
  const { color } = useTheme();
  const [hidden] = useHideBalances();
  const close = useSheetClose();
  return (
    <View>
      {PART_PERCENTS.map((pct) => {
        const v = amountAt(pct);
        const text = v === null ? "—" : masked(dollars(v), hidden);
        return (
          <Pressable
            key={String(pct)}
            disabled={v === null}
            accessibilityRole="button"
            accessibilityLabel={`${title} ${pct === HUNDRED ? "all of it" : `${pct} percent`}, about ${text}`}
            onPress={() => {
              fire("press");
              close(() => onPick(pct));
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
          >
            <Text style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
              {pct === HUNDRED ? "All of it" : `${pct}%`}
            </Text>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PartSheet(props: {
  title: string;
  amountAt: (percent: bigint) => bigint | null;
  onPick: (percent: bigint) => void;
  onClose: () => void;
}) {
  const { onClose, ...rest } = props;
  return (
    <Sheet onClose={onClose} closeLabel={`Close ${props.title.toLowerCase()}`}>
      <SheetHeading title={props.title} body="Keep the rest riding" />
      <Rows {...rest} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: SIZE.touch + SPACE.sm,
    paddingHorizontal: SIZE.gutter,
    gap: SPACE.md,
  },
  flex: { flex: 1 },
});
