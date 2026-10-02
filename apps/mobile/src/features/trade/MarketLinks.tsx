/**
 * Market detail's cross-links (flow book C2 step 4, rule 6 "every list item opens a detail"): "Own real gold ›" on
 * XAU, which opens the XAUt0 token page (the spot route, plan decision 2 Oct), and "Your position ›" when one is open
 * in this market (C5 entry point). Rows, not boxes: a mark, a title and one short subtitle, and a chevron.
 */
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import { usePositions } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChevronRight } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { assetRoute, positionRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { quantityText } from "./quantity";

/** Tether Gold on Monad (XAUt0, 6 decimals; flow book routes.md, rechecked 2 Oct). */
const XAUT0 = { symbol: "XAUt0", address: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071" } as const;
/** Which engine markets have a real asset to own on Monad. */
const OWN_IT: Readonly<Record<string, { title: string; symbol: string; address: string; mark: string }>> = {
  XAU: {
    title: "Own real gold",
    symbol: XAUT0.symbol,
    address: XAUT0.address,
    mark: ids.token(MAINNET_CHAIN_ID, XAUT0.address),
  },
};

/** One cross-link row: mark, title, one short subtitle, chevron (shared with Perpl's market page). */
export function LinkRow({
  mark,
  label,
  title,
  subtitle,
  onPress,
}: {
  mark: string;
  label: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}`}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <EntityMark id={mark} size={SIZE.markToken} label={label} decorative />
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * "Own real gold ›" — only where a real asset exists to hold. Routed by chain + address (B2): XAUt0 is on Monad's
 * token list but not the J11 spot list, so the symbol route would fall back to Markets. In Practice the asset page
 * names that it is on Mainnet and offers the mode switch.
 */
export function OwnItRow({ symbol }: { symbol: string }) {
  const own = OWN_IT[symbol];
  if (!own) return null;
  return (
    <LinkRow
      mark={own.mark}
      label={own.symbol}
      title={own.title}
      subtitle={`${own.symbol} on Monad`}
      onPress={() => router.push(assetRoute(MAINNET_CHAIN_ID, own.address))}
    />
  );
}

/** "Your position ›" with its side and size, when this account holds one in the market. */
export function HeldRow({ marketId }: { marketId: number }) {
  const network = useNetwork();
  const positions = usePositions(useAccount().hint?.address);
  const held =
    positions.status === "fresh" || positions.status === "stale"
      ? positions.value.find((p) => p.marketId === marketId)
      : undefined;
  if (!held) return null;
  return (
    <LinkRow
      mark={ids.engineMarket(network.chainId, marketId)}
      label=""
      title="Your position"
      subtitle={`${held.isLong ? "Long" : "Short"} · ${quantityText(marketId, held.size)}`}
      onPress={() => router.push(positionRoute(String(marketId)))}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight - SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
