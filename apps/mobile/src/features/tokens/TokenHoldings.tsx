/**
 * Home's spot tokens (J11, v2-plan "held in the user's Monad account and shown in Home"): on Mainnet, the listed
 * tokens this account holds, largest first, each with what it's worth at the pool's mid price, under their total.
 * Nothing shows when it holds none — Home never lists empty rows — and nothing shows in Practice, where there are no
 * token pools. A row opens the token's page.
 */
import { spotValueUsd6 } from "@senryo/chain";
import { useTokenHoldings, useTokenPrices, useTokenStats } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { SectionLabel } from "~/components/kit/Surface";
import { useAccount } from "~/lib/account/provider";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";
import { TokenRow } from "./TokenRow";

/** `bare`: rows only, for Home → Assets (the tab is the heading). */
export function TokenHoldings({ bare = false }: { bare?: boolean } = {}) {
  const { color } = useTheme();
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const holdings = useTokenHoldings(network.key === "mainnet" ? address : undefined);
  const prices = useTokenPrices();
  const stats = useTokenStats();
  if (network.key !== "mainnet" || (holdings.status !== "fresh" && holdings.status !== "stale")) return null;
  const priced = prices.status === "fresh" || prices.status === "stale" ? prices.value : [];
  const rows = holdings.value
    .filter((h) => h.balance > 0n)
    .map((h) => {
      const price = priced.find((p) => p.token.symbol === h.token.symbol)?.priceUsd18;
      return { ...h, price, valueUsd6: price ? spotValueUsd6(h.balance, h.token.decimals, price) : undefined };
    })
    .sort((a, b) => Number((b.valueUsd6 ?? 0n) - (a.valueUsd6 ?? 0n)));
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + (r.valueUsd6 ?? 0n), 0n);
  return (
    <View>
      {bare ? null : (
        <View style={styles.heading}>
          <SectionLabel>Tokens</SectionLabel>
          <Text style={[TYPE.rowAmount, { color: color.ink }]}>{usd(total, undefined, "mainnet")}</Text>
        </View>
      )}
      {rows.map((r) => (
        <TokenRow
          key={r.token.symbol}
          token={r.token}
          priceUsd18={r.price ?? null}
          change24hBps={
            stats.status === "fresh" || stats.status === "stale"
              ? stats.value.get(r.token.symbol)?.change24hBps
              : undefined
          }
          held={{ balance: r.balance, valueUsd6: r.valueUsd6 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: SPACE.xs },
});
