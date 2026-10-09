/**
 * React Native port of 21st:astralyxdev/odds-display (#36173; the web's `odds-display.tsx`): a selectable price showing
 * what $1 returns, with an arrow when it drifted out (pays more) or shortened (pays less) since a reference — flagged,
 * never animated. Decimal only ("1.92×"), "—" when not priced; the press scale is the kit's.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { ArrowDown, ArrowUp } from "./symbols";
import { usePressScale } from "./usePressScale";

const ODDS_DECIMALS = 2;
const ARROW = 12;
const MIN_WIDTH = 76;

export function OddsButton(p: {
  label: string;
  odds: number | null;
  previousOdds?: number | null | undefined;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const shown = p.odds === null ? null : p.odds.toFixed(ODDS_DECIMALS);
  const before = p.previousOdds == null ? null : p.previousOdds.toFixed(ODDS_DECIMALS);
  const drifted = shown !== null && before !== null && shown !== before;
  const out = drifted && Number(shown) > Number(before);
  const ink = p.selected ? color.ground : color.ink;
  return (
    <Pressable
      disabled={p.odds === null}
      onPress={() => {
        fire("tick");
        p.onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: p.selected, disabled: p.odds === null }}
      accessibilityLabel={`${p.accessibilityLabel}, ${shown ? `pays ${shown} times` : "not priced"}${drifted ? (out ? ", pays more than when picked" : ", pays less than when picked") : ""}`}
    >
      <Animated.View
        style={[
          styles.plate,
          { backgroundColor: p.selected ? color.ink : color.raised2, opacity: p.odds === null ? DISABLED_OPACITY : 1 },
          press.style,
        ]}
      >
        <Text style={[TYPE.caption, { color: p.selected ? color.ground : color.inkMuted }]}>{p.label}</Text>
        <View style={styles.row}>
          <Text style={[TYPE.rowTitle, styles.digits, { color: ink }]}>{shown === null ? "—" : `${shown}×`}</Text>
          {drifted && out ? <ArrowUp size={ARROW} color={color.up} /> : null}
          {drifted && !out ? <ArrowDown size={ARROW} color={color.down} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    minWidth: MIN_WIDTH,
    minHeight: SIZE.touch,
    borderRadius: SPACE.md,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  digits: { fontVariant: ["tabular-nums"] },
});
