/**
 * The position's TP/SL row (flow book C6 step 3; plan §0.9 Position): one row — "Add" when none is set, otherwise the
 * levels ("SL $3,350 · TP $3,600") — that opens the Fomo F44 sheet, where Save replaces a level and Clear removes it.
 * "All orders ›" under it opens Orders (C8 entry point).
 */
import type { LiveMarket } from "@senryo/query";
import { useTriggers } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { price18, priceDecimalsOf } from "~/lib/money";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function TpSlRow({ market, onOpen }: { market: LiveMarket; onOpen: () => void }) {
  const { color } = useTheme();
  const triggers = useTriggers(useAccount().hint?.address);
  const decimals = priceDecimalsOf(market.marketId);
  const levels =
    triggers.status === "fresh" || triggers.status === "stale"
      ? triggers.value
          .filter((t) => t.market_id === `ours-${market.marketId}`)
          .sort((a, b) => Number(a.takeProfit) - Number(b.takeProfit))
      : [];
  const summary = levels.map((t) => `${t.takeProfit ? "TP" : "SL"} $${price18(t.triggerPrice, decimals)}`).join(" · ");
  return (
    <View>
      <Pressable
        onPress={() => {
          fire("tick");
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Stop loss and take profit: ${summary || "none set"}`}
        accessibilityHint="Opens the stop loss and take profit sheet"
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
          TP / SL
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowAmount, styles.shrink, { color: summary ? color.ink : color.link }]}
        >
          {summary || "Add"}
        </Text>
        <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      <Pressable
        onPress={() => {
          fire("tick");
          router.push(ROUTES.orders);
        }}
        accessibilityRole="link"
        hitSlop={SPACE.sm}
        style={styles.all}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.link }]}>
          All orders ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch + SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  all: { alignSelf: "flex-start", minHeight: SIZE.touch - SPACE.md, justifyContent: "center" },
});
