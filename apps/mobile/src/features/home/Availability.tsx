import type { AccountSnapshot } from "@senryo/chain";
import { StyleSheet, Text, View } from "react-native";
import { useGroupFill } from "~/components/kit/Surface";
import { usd } from "~/lib/money";
import { SHEET_SHAPE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Home's availability (D-178, Codex S1b.7 consult #9): Free to trade, Free to spend and Locked as three plain labelled
 * capacities — overlapping, so never an additive partition bar or a percentage legend (the D2 `BucketRegister` is
 * retired here). Each is a borderless filled cell, one step lighter than the page. J6 (S1b.10) replaces this with the
 * explained cells and the reconciling balance details.
 */
export function Availability({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const locked = snapshot.equityInit - snapshot.freeToTrade;
  const cells = [
    { key: "trade", label: "Free to trade", value: snapshot.freeToTrade },
    { key: "spend", label: "Free to spend", value: snapshot.freeToSpend },
    { key: "locked", label: "Locked", value: locked > 0n ? locked : 0n },
  ] as const;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cells.map((c) => (
          <View
            key={c.key}
            accessible
            accessibilityLabel={`${c.label} ${usd(c.value)}`}
            style={[styles.cell, { backgroundColor: fill }]}
          >
            <Text style={[TYPE.meta, { color: color.text3 }]} numberOfLines={1}>
              {c.label}
            </Text>
            <Text
              style={[TYPE.rowAmount, { color: c.value < 0n ? color.down : color.ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {usd(c.value)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        These overlap — they are what each use can draw on, not parts that add up to your balance.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  row: { flexDirection: "row", gap: SPACE.sm },
  cell: { flex: 1, gap: SPACE.xxs, padding: SPACE.md, borderRadius: SHEET_SHAPE.rowRadius },
});
