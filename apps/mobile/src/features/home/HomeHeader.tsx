import { ids } from "@senryo/identity";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { AmountHero } from "~/components/kit/AmountHero";
import { Skeleton } from "~/components/kit/states";
import { ArrowUp, Eye, Info, Plus, QrCode, Send } from "~/components/kit/symbols";
import { ActionCircle, ActionCircles } from "~/features/money/ActionCircle";
import { type BalanceSheet, useBalanceSheet } from "~/features/portfolio/useBalanceSheet";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useTermsGate } from "~/lib/account/terms-gate";
import { ROUTES } from "~/lib/constants/routes";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function HomeSeal() {
  const { color } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Senryo home">
      <EntityMark id={ids.brand("senryo")} size={SIZE.avatarSm} variant="symbol" decorative ground={color.ground} />
    </View>
  );
}
/** The sheet has a number to show: it finished reading and at least one part was read and valued. */
function readable(sheet: BalanceSheet): boolean {
  return sheet.status === "ready" && sheet.rows.some((r) => r.valueUsd6 !== undefined);
}

export function CompactBalance() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const sheet = useBalanceSheet();
  const [hidden] = useHideBalances();
  if (!address || !readable(sheet)) return null;
  return (
    <Text style={[TYPE.rowAmount, { color: color.ink }]} numberOfLines={1}>
      {sheet.partial && !hidden ? "≈ " : ""}
      {masked(usd(sheet.totalUsd6, 2, "mainnet"), hidden)}
    </Text>
  );
}
export function ExpandedBalance() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const gate = useTermsGate();
  const practice = useNetwork().key === "testnet";
  const [hidden, setHidden] = useHideBalances();
  // The hero reads the balance sheet's own total, so tapping it never shows a different number (B16).
  const sheet = useBalanceSheet();
  if (!address) return null;
  const partial = sheet.partial;
  return (
    <View style={styles.hero}>
      <View style={styles.heading}>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{practice ? "Paper money" : "Total balance"}</Text>
        <Pressable
          onPress={() => setHidden(!hidden)}
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show balances" : "Hide balances"}
          hitSlop={SPACE.sm}
        >
          <Eye size={SIZE.iconSm} color={color.text3} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push(ROUTES.balanceDetails)}
        // Long-press hides or shows balances (Settings → Hide balances is the same switch).
        onLongPress={() => {
          fire("tick");
          setHidden(!hidden);
        }}
        accessibilityRole="button"
        accessibilityHint="Opens what makes up your total. Long-press to hide or show balances"
        style={styles.amounts}
      >
        {readable(sheet) ? (
          <View style={styles.line}>
            <AmountHero
              text={masked(usd(sheet.totalUsd6, 2, "mainnet"), hidden)}
              partial={partial && !hidden}
              decimalRole={TYPE.numMd}
            />
            {partial && !hidden ? (
              <Info size={SIZE.iconSm} color={color.text3} accessibilityLabel="Some values are missing" />
            ) : null}
          </View>
        ) : sheet.status === "ready" ? (
          <Text style={[TYPE.row, { color: color.text3 }]}>Balance unavailable</Text>
        ) : (
          <Skeleton width={200} height={SIZE.skeletonRow} />
        )}
      </Pressable>
      <ActionCircles>
        <ActionCircle
          icon={Plus}
          label="Add money"
          onPress={() => gate(() => router.push(ROUTES.addMoney), { verb: "add money", next: ROUTES.addMoney })}
        />
        <ActionCircle
          icon={Send}
          label="Send"
          onPress={() => gate(() => router.push(ROUTES.withdrawSend), { verb: "send", next: ROUTES.withdrawSend })}
        />
        <ActionCircle
          icon={QrCode}
          label="Receive"
          onPress={() => gate(() => router.push(ROUTES.receive), { verb: "add money", next: ROUTES.receive })}
        />
        <ActionCircle
          icon={ArrowUp}
          label="Withdraw"
          onPress={() => gate(() => router.push(ROUTES.withdraw), { verb: "send", next: ROUTES.withdraw })}
        />
      </ActionCircles>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { gap: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  amounts: { gap: SPACE.xs },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
