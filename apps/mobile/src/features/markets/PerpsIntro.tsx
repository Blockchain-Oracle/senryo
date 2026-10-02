/**
 * The Perps list's intro (FT072, Fomo F11): one filled plate — a small long/short drawing, "Go long or short", what
 * can be traded here and the highest leverage the listed markets allow (read from them, never a fixed number) — that
 * opens the risk explainer, and an × that dismisses it on this phone for good.
 */
import { useMarkets } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import Svg, { Path } from "react-native-svg";
import { Panel } from "~/components/kit/Surface";
import { X } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The drawing's box (pt) and its two strokes: a rise that ends in an arrow, a fall that ends in one. */
const ART_W = 64;
const ART_H = 48;
const STROKE = 3;
const RISE = "M2 34 C 16 34, 22 10, 34 20 S 50 30, 58 6 M52 6 L58 6 L58 12";
const FALL = "M2 14 C 16 14, 22 38, 34 28 S 50 18, 58 42 M52 42 L58 42 L58 36";

export function PerpsIntro() {
  const { color } = useTheme();
  const [dismissed, setDismissed] = useMMKVBoolean(STORAGE_KEYS.perpsIntroDismissed, storage);
  const markets = useMarkets();
  if (dismissed) return null;
  const max = markets.reduce(
    (m, x) =>
      x.reading.status === "fresh" || x.reading.status === "stale" ? Math.max(m, x.reading.value.maxLeverageX) : m,
    0,
  );
  return (
    <Panel style={styles.plate}>
      <Pressable
        onPress={() => {
          fire("tick");
          router.push(ROUTES.riskExplainer);
        }}
        accessibilityRole="button"
        accessibilityHint="Opens how leverage and liquidation work"
        style={styles.body}
      >
        <Svg width={ART_W} height={ART_H} viewBox={`0 0 ${ART_W} ${ART_H}`} accessibilityElementsHidden>
          <Path d={FALL} stroke={color.down} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <Path d={RISE} stroke={color.up} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        </Svg>
        <View style={styles.text}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Go long or short</Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            Trade gold, silver and the major currencies{max > 0 ? ` with up to ${max}× leverage` : ""}. A position can
            be liquidated; see how it works.
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          fire("tick");
          setDismissed(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss the long and short intro"
        hitSlop={SPACE.md}
        style={styles.close}
      >
        <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
    </Panel>
  );
}

const styles = StyleSheet.create({
  plate: { flexDirection: "row", alignItems: "flex-start", padding: SPACE.md, gap: SPACE.sm },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.md },
  text: { flex: 1, gap: SPACE.xxs },
  close: { paddingTop: SPACE.xxs },
});
