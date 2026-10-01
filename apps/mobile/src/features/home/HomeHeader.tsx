import { RISK } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useAccountRisk, useEquityHistory, useNetFlows } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { DAY_SEC } from "~/features/portfolio/constants";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { arrow, signedPct, signedUsd, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Home's collapsing header pieces (C16/C19, FT069/FT073; Fomo F09 / F12). The bar keeps the 千 seal and — once
 * collapsed — the compact balance (F12). The expanded block is F09's: the balance as the one big figure with its
 * cents in quiet ink, its sourced 24 h change under it — net of money moved in or out ("— 24h" when unknown) — and
 * Add money to its right at the Deposit's proportions. The figure is the risk-adjusted balance; Balance details names
 * it and reconciles it, so no label stands over it here. Unknown balances are skeletons, never $0.00 (D-020).
 */
const SEAL = ids.brand("senryo");
/** The big figure may shrink to this share of its size before it truncates, so a long balance still fits beside the button. */
const BALANCE_MIN_SCALE = 0.5;
/** Skeleton widths while the balance and its change are unknown. */
const BALANCE_SKELETON_WIDTH = 168;
const CHANGE_SKELETON_WIDTH = 96;
/** F09's Deposit measures 140 pt wide; the kit button keeps its own 56 pt height and 12 pt corners. */
const ADD_MONEY_WIDTH = 140;

export function HomeSeal() {
  const { color } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Senryo home">
      <EntityMark id={SEAL} size={SIZE.avatarSm} variant="symbol" decorative ground={color.ground} />
    </View>
  );
}

/**
 * The balance and how it did over the day: today's balance against the day's first one, less the money moved in or
 * out since (a withdrawal or a send is not a loss; a deposit or a claim is not a gain). Percent of what the day
 * started with plus what came in.
 */
function useBalance() {
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  const day = useEquityHistory(address, DAY_SEC);
  const equity = risk.status === "fresh" || risk.status === "stale" ? risk.value.equityInit : undefined;
  const first = day.status === "fresh" || day.status === "stale" ? day.value[0] : undefined;
  const flows = useNetFlows(address, first?.timestamp);
  const moved = flows.status === "fresh" || flows.status === "stale" ? flows.value : undefined;
  const change = first && moved && equity !== undefined ? equity - first.equityInit - moved.net : undefined;
  const base = first && moved ? first.equityInit + moved.inflow : undefined;
  const changeBps = base !== undefined && base > 0n && change !== undefined ? (change * RISK.BPS) / base : undefined;
  return { address, equity, change, changeBps };
}

/** The collapsed bar's balance. Nothing until the balance is known. */
export function CompactBalance() {
  const { color } = useTheme();
  const { equity } = useBalance();
  if (equity === undefined) return null;
  return (
    <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: color.ink }]} numberOfLines={1}>
      {usd(equity)}
    </Text>
  );
}

export function ExpandedBalance() {
  const { color } = useTheme();
  const { address, equity, change, changeBps } = useBalance();
  if (!address) return null;
  const text = equity === undefined ? "" : usd(equity);
  // F09: "$0" in full ink, ".00" quiet — the whole units carry the figure.
  const point = text.lastIndexOf(".");
  const whole = point < 0 ? text : text.slice(0, point);
  const cents = point < 0 ? "" : text.slice(point);
  return (
    <View style={styles.hero}>
      <View style={styles.amounts}>
        {equity === undefined ? (
          <View style={styles.pending}>
            <Skeleton width={BALANCE_SKELETON_WIDTH} height={SIZE.skeletonRow} />
            <Skeleton width={CHANGE_SKELETON_WIDTH} height={SIZE.skeletonSmall} />
          </View>
        ) : (
          <>
            <Text
              maxFontSizeMultiplier={HERO_FONT_SCALE}
              adjustsFontSizeToFit
              minimumFontScale={BALANCE_MIN_SCALE}
              numberOfLines={1}
              accessibilityLabel={`Risk-adjusted balance ${text}`}
              style={[TYPE.displayBalance, { color: color.ink }]}
            >
              {whole}
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: color.text3 }}>
                {cents}
              </Text>
            </Text>
            {change === undefined ? (
              <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: color.text3 }]}>
                — 24h
              </Text>
            ) : (
              <Text
                maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                style={[TYPE.rowChange, { color: change >= 0n ? color.up : color.down }]}
                numberOfLines={1}
              >
                {arrow(change)} {signedUsd(change)}
                {changeBps === undefined ? "" : ` (${signedPct(changeBps)})`}
                <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={{ color: color.text3 }}>
                  {" "}
                  24h
                </Text>
              </Text>
            )}
          </>
        )}
      </View>
      <Button label="Add money" block={false} style={styles.add} onPress={() => router.push(ROUTES.addMoney)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  amounts: { flex: 1, gap: SPACE.xxs },
  pending: { gap: SPACE.sm, paddingVertical: SPACE.xs },
  add: { alignSelf: "center", minWidth: ADD_MONEY_WIDTH },
});
