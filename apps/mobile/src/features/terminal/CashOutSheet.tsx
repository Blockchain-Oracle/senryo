/**
 * Cash out part of a call (pivot "Cash out": a long-press on CLOSE offers 25 / 50 / 100 %): each row says what it
 * returns at the bid the sheet opened on; the call itself takes the live bid less the tolerance, like a full cash-out.
 */
import { formatUnits, proceedsFor } from "@senryo/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const HUNDRED = 100n;
const QUARTER = 25n;
const HALF = 50n;
export const PARTS = [QUARTER, HALF, HUNDRED] as const;

function Rows({ shares, bidE6, onPick }: { shares: bigint; bidE6: bigint; onPick: (percent: bigint) => void }) {
  const { color } = useTheme();
  const close = useSheetClose();
  return (
    <View>
      {PARTS.map((pct) => {
        const back = proceedsFor((shares * pct) / HUNDRED, bidE6);
        const text = `$${formatUnits(back, DOLLAR_DECIMALS, CENTS)}`;
        return (
          <Pressable
            key={String(pct)}
            accessibilityRole="button"
            accessibilityLabel={`Cash out ${pct} percent, about ${text}`}
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

export function CashOutSheet(props: {
  shares: bigint;
  bidE6: bigint;
  onPick: (percent: bigint) => void;
  onClose: () => void;
}) {
  const { onClose, ...rest } = props;
  return (
    <Sheet onClose={onClose} closeLabel="Close cash out">
      <SheetHeading title="Cash out" body="Keep the rest riding" />
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
