/**
 * Markets → Tokens (J11, S1b.16; Fomo F10): Monad's spot tokens with a real Uniswap v4 pool, bought and sold with
 * USDC from your own account. Tokens you hold lead, with what they're worth; the rest follow in the list's order. The
 * pools live on Monad mainnet only, so in Practice the prices are the real ones, read-only, and the page says so once
 * at the top. Prices are the pools' mid prices onchain; the 24 h change is GeckoTerminal's, credited at the foot.
 */
import { spotValueUsd6 } from "@senryo/chain";
import { SPOT_TOKENS } from "@senryo/config";
import { useTokenHoldings, useTokenPrices, useTokenStats } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { SectionLabel } from "~/components/kit/Surface";
import { QuietLine } from "~/features/markets/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { TokenRow } from "./TokenRow";

export function TokensList() {
  const { color } = useTheme();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const prices = useTokenPrices();
  const stats = useTokenStats();
  const holdings = useTokenHoldings(address);
  const priceOf = (symbol: string): bigint | null | undefined => {
    if (prices.status !== "fresh" && prices.status !== "stale") return prices.status === "failed" ? null : undefined;
    return prices.value.find((p) => p.token.symbol === symbol)?.priceUsd18 ?? null;
  };
  const statsOf = (symbol: string) =>
    stats.status === "fresh" || stats.status === "stale" ? stats.value.get(symbol) : undefined;
  const heldOf = (symbol: string) => {
    if (holdings.status !== "fresh" && holdings.status !== "stale") return undefined;
    const h = holdings.value.find((x) => x.token.symbol === symbol);
    if (!h || h.balance === 0n) return undefined;
    const price = priceOf(symbol);
    return { balance: h.balance, valueUsd6: price ? spotValueUsd6(h.balance, h.token.decimals, price) : undefined };
  };
  const held = SPOT_TOKENS.filter((t) => heldOf(t.symbol) !== undefined).sort((a, b) =>
    Number((heldOf(b.symbol)?.valueUsd6 ?? 0n) - (heldOf(a.symbol)?.valueUsd6 ?? 0n)),
  );
  const rest = SPOT_TOKENS.filter((t) => !held.includes(t));
  if (SPOT_TOKENS.length === 0) return <QuietLine>No Monad token has a live pool yet</QuietLine>;
  const row = (t: (typeof SPOT_TOKENS)[number]) => (
    <TokenRow
      key={t.symbol}
      token={t}
      priceUsd18={priceOf(t.symbol)}
      change24hBps={statsOf(t.symbol)?.change24hBps}
      held={heldOf(t.symbol)}
    />
  );
  return (
    <>
      {network.key === "testnet" ? (
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Spot tokens trade on Mainnet with real money. These are their live prices; buying and selling open on Mainnet.
        </Text>
      ) : null}
      {held.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Yours</SectionLabel>
          {held.map(row)}
        </View>
      ) : null}
      <View>
        <View style={styles.caption}>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
            Tokens · 24h
          </Text>
          <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
            Uniswap v4 · Monad
          </Text>
        </View>
        {rest.map(row)}
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>24 h change from GeckoTerminal.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: SPACE.sm },
  label: { paddingBottom: SPACE.xs },
});
