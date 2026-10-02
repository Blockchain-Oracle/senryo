/**
 * Home → Assets (flow book B1, D-239/D-240): everything the account holds as one list, largest first. Dollar assets
 * fold their trading-account part into the row (the trading account is internal), and the part that backs open
 * positions or card holds says so in place ("P$300 in trades") instead of a separate "available" grid. Tokens follow
 * (Mainnet). A row opens the asset. Any-asset discovery (unknown tokens under "Other tokens") replaces the listed-token
 * read when the holdings service lands; the row anatomy stays.
 */
import { collateralId } from "@senryo/identity";
import { useAccountRisk, useQueryEnv, useWalletCollateral } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { PositionRowsSkeleton } from "~/features/home/HomeParts";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { TokenHoldings } from "~/features/tokens/TokenHoldings";
import { useAccount } from "~/lib/account/provider";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLARS = [
  { symbol: "AUSD", name: "Agora USD" },
  { symbol: "USDC", name: "USD Coin" },
] as const;

export function AssetsTab() {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const wallet = useWalletCollateral(address);
  const risk = useAccountRisk(address, "finalized");
  const walletValue = wallet.status === "fresh" || wallet.status === "stale" ? wallet.value : undefined;
  const account = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  if (!walletValue && !account) return <PositionRowsSkeleton />;
  // What backs positions and card holds right now; shown once, on the largest dollar row.
  const lockedUsd6 = account ? account.equityInit - account.freeToTrade : 0n;
  const rows = DOLLARS.map((d) => {
    const inWallet = walletValue?.[d.symbol] ?? 0n;
    const inTrading = account ? (d.symbol === "AUSD" ? account.ausd : account.usdc) : 0n;
    return { ...d, total: inWallet + inTrading };
  })
    .filter((r) => r.total > 0n)
    .sort((a, b) => Number(b.total - a.total));
  return (
    <View>
      {rows.length === 0 ? <QuietLine>Nothing here yet</QuietLine> : null}
      {rows.map((r, i) => (
        <AssetRow
          key={r.symbol}
          markId={collateralId(env.chainId, r.symbol)}
          symbol={r.symbol}
          detail={i === 0 && lockedUsd6 > 0n ? `${usd(lockedUsd6)} in trades` : r.name}
          amount={usd(r.total)}
        />
      ))}
      <TokenHoldings bare />
    </View>
  );
}

/** One holding: mark, symbol over name (or what's locked), value at the right. */
export function AssetRow({
  markId,
  symbol,
  detail,
  amount,
}: {
  markId: string;
  symbol: string;
  detail: string;
  amount: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${symbol}, ${amount}, ${detail}`}>
      <EntityMark id={markId} size={SIZE.markDetail} decorative />
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
          {symbol}
        </Text>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.rowDetail, { color: color.text2 }]}
        >
          {detail}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: color.ink }]}>
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
