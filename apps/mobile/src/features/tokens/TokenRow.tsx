import type { SpotToken } from "@senryo/config";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { tokenRoute } from "~/lib/constants/routes";
import { arrow, signedPct, usd } from "~/lib/money";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { tokenAmount, tokenPrice } from "./format";

/** Skeleton width of a price still loading. */
const PRICE_SKELETON = 72;

/**
 * One spot token (Fomo F10, C22): its real logo from the Monad token list, symbol over name — or over what you hold
 * and its worth — then the live price over its 24 h change with ▲▼ and a sign. A token whose route has no live pool
 * says so in place of a price. The row opens the token's page.
 */
export function TokenRow({
  token,
  priceUsd18,
  change24hBps,
  held,
}: {
  token: SpotToken;
  /** Undefined while loading; null when a hop has no live pool. */
  priceUsd18: bigint | null | undefined;
  change24hBps: bigint | undefined;
  /** What the account holds: raw units and their USD worth (usd6), when it holds any. */
  held?: { balance: bigint; valueUsd6: bigint | undefined } | undefined;
}) {
  const { color } = useTheme();
  const tint = change24hBps === undefined ? color.text3 : change24hBps >= 0n ? color.up : color.down;
  const detail = held
    ? `${tokenAmount(held.balance, token.decimals, token.symbol)}${held.valueUsd6 === undefined ? "" : ` · ${usd(held.valueUsd6, undefined, "mainnet")}`}`
    : token.name;
  const priceText = priceUsd18 ? tokenPrice(priceUsd18) : undefined;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(tokenRoute(token.symbol));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${token.name}, ${token.symbol}${priceText ? `, ${priceText}` : ""}${change24hBps === undefined ? "" : `, ${change24hBps >= 0n ? "up" : "down"} ${signedPct(change24hBps)} in 24 hours`}${held ? `, you hold ${detail}` : ""}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <EntityMark id={token.mark} size={SIZE.markDetail} decorative />
      <View style={styles.name}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowTitle, { color: color.ink }]}
        >
          {token.symbol}
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowDetail, { color: held ? color.text2 : color.text3 }]}
        >
          {detail}
        </Text>
      </View>
      <View style={styles.price}>
        {priceUsd18 === undefined ? (
          <Skeleton width={PRICE_SKELETON} />
        ) : (
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
            {priceText ?? "No live pool"}
          </Text>
        )}
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: tint }]}>
          {change24hBps === undefined ? "24h —" : `${arrow(change24hBps)} ${signedPct(change24hBps)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  name: { flex: 1, gap: SPACE.xxs },
  price: { alignItems: "flex-end", gap: SPACE.xxs },
});
