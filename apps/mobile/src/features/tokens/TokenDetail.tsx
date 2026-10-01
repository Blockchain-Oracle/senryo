/**
 * A spot token's page (J11, S1b.16; market detail's anatomy, F32): its real logo, symbol and name in the bar → the
 * live price and 24 h change → the pool's candles → what you hold of it → the facts (network, contract, the pool and
 * the route a trade takes, 24 h volume) → sticky Sell / Buy. The pools are on Monad mainnet; in Practice the page is
 * the real market, read-only, and the bar under it offers the switch instead of a trade.
 */
import { spotValueUsd6 } from "@senryo/chain";
import { MAINNET_CHAIN_ID, networkOf, type SpotToken } from "@senryo/config";
import { spotToken, useTokenHoldings, useTokenPrices, useTokenStats } from "@senryo/query";
import { type Href, router, Stack } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { QuietLine } from "~/features/markets/QuietLine";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, tokenRoute, tokenTradeRoute } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { arrow, signedPct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { compactUsd, tokenAmount, tokenPrice } from "./format";
import { TokenChart } from "./TokenChart";

/** Skeleton widths while the price reads. */
const PRICE_SKELETON = 180;
const PIPS_PER_PERCENT = 10_000;
const PRESSED = 0.85;

export function TokenDetail({ symbol }: { symbol: string }) {
  const token = spotToken(symbol);
  useHideDockWhileFocused("token-detail");
  if (!token) {
    return (
      <Plain title={symbol}>
        <QuietLine>{symbol} has no live Uniswap pool on Monad</QuietLine>
      </Plain>
    );
  }
  return <Detail token={token} />;
}

function Plain({ title, children }: { title: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <PageTitle>{title}</PageTitle>
      </PageHeader>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function Detail({ token }: { token: SpotToken }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const prices = useTokenPrices([token]);
  const stats = useTokenStats();
  const holdings = useTokenHoldings(address, [token]);
  const price = prices.status === "fresh" || prices.status === "stale" ? prices.value[0]?.priceUsd18 : undefined;
  const stat = stats.status === "fresh" || stats.status === "stale" ? stats.value.get(token.symbol) : undefined;
  const held = holdings.status === "fresh" || holdings.status === "stale" ? holdings.value[0]?.balance : undefined;
  const change = stat?.change24hBps;
  const tint = change === undefined ? color.text3 : change >= 0n ? color.up : color.down;
  const route = ["USDC", ...token.route.map((_, i) => (i === token.route.length - 1 ? token.symbol : token.quote))];
  const fee = (token.pool.key.fee / PIPS_PER_PERCENT).toString();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <View style={styles.identity}>
          <EntityMark id={token.mark} size={SIZE.markDetail} decorative />
          <View>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{token.symbol}</Text>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{token.name}</Text>
          </View>
        </View>
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <View style={styles.price}>
          {price ? (
            <Text accessibilityRole="header" style={[TYPE.displayPrice, { color: color.ink }]}>
              {tokenPrice(price)}
            </Text>
          ) : (
            <Skeleton width={PRICE_SKELETON} height={SIZE.skeletonRow} />
          )}
          <Text style={[TYPE.rowChange, { color: tint }]}>
            {change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)} 24h`}
          </Text>
        </View>
        <TokenChart token={token} priceUsd18={price} />
        {held !== undefined && held > 0n ? (
          <Panel style={styles.panel}>
            <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Yours · in your Monad account</Text>
            <Text style={[TYPE.rowAmount, { color: color.ink }]}>
              {tokenAmount(held, token.decimals, token.symbol)}
            </Text>
            {price ? (
              <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
                {usd(spotValueUsd6(held, token.decimals, price), undefined, "mainnet")}
              </Text>
            ) : null}
          </Panel>
        ) : null}
        <View style={styles.facts}>
          <KeyValue label="Network" value="Monad mainnet" />
          <KeyValue label="Contract" value={token.native ? "Native MON" : shortAddress(token.address)} />
          <KeyValue label="Pool" value={`${token.symbol}/${token.quote} · ${fee}% fee`} />
          <KeyValue label="A buy routes" value={route.join(" → ")} />
          {stat?.volume24hUsd !== undefined ? (
            <KeyValue label="Pool volume, 24 h" value={compactUsd(stat.volume24hUsd)} />
          ) : null}
          {stat?.fdvUsd !== undefined ? <KeyValue label="Fully diluted value" value={compactUsd(stat.fdvUsd)} /> : null}
          <KeyValue label="Price" value="The pool's mid price, read onchain" />
        </View>
      </ScrollView>
      <TradeBar token={token} practice={network.key === "testnet"} />
    </View>
  );
}

/**
 * Sticky Sell / Buy (F32's Short / Long, in the same fills and 12 pt corners). In Practice there is nothing to trade
 * with, so the bar says where tokens trade and offers the switch — the network sheet, continuing back here.
 */
function TradeBar({ token, practice }: { token: SpotToken; practice: boolean }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const frame = [styles.bar, { paddingBottom: insets.bottom + SPACE.sm, backgroundColor: color.ground }];
  if (practice) {
    const mainnet = networkOf(MAINNET_CHAIN_ID);
    const next = encodeURIComponent(tokenRoute(token.symbol));
    return (
      <View style={[frame, styles.column]}>
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
          {token.symbol} trades on Mainnet with real money.
        </Text>
        <Button
          label={`Switch to ${mainnet.modeLabel}`}
          onPress={() => router.push(`${ROUTES.network}?to=${mainnet.key}&next=${next}` as Href)}
        />
      </View>
    );
  }
  return (
    <View style={frame}>
      <SideButton word="Sell" fill={color.down} ink={color.downForeground} token={token} side="sell" />
      <SideButton word="Buy" fill={color.up} ink={color.upForeground} token={token} side="buy" />
    </View>
  );
}

function SideButton({
  word,
  fill,
  ink,
  token,
  side,
}: {
  word: string;
  fill: string;
  ink: string;
  token: SpotToken;
  side: "buy" | "sell";
}) {
  const press = usePressScale();
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("press");
          router.push(tokenTradeRoute(token.symbol, side));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${word} ${token.symbol}`}
        accessibilityHint="Opens the swap ticket"
        style={({ pressed }) => [styles.side, { backgroundColor: fill, opacity: pressed ? PRESSED : 1 }]}
      >
        <Text style={[TYPE.buttonLabel, { color: ink }]}>{word}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  price: { gap: SPACE.xs },
  panel: { padding: SPACE.lg, gap: SPACE.xs },
  facts: { gap: SPACE.sm },
  bar: { flexDirection: "row", gap: SPACE.md, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
  column: { flexDirection: "column" },
  center: { textAlign: "center" },
  flex: { flex: 1 },
  side: { height: SIZE.buttonHeight, borderRadius: BUTTON.radius.md, alignItems: "center", justifyContent: "center" },
});
