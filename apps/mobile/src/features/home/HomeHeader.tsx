import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { CreditCard, Eye, Info } from "~/components/kit/symbols";
import { useBalanceSheet } from "~/features/portfolio/useBalanceSheet";
import { useOwnProfile } from "~/features/profile/useOwnProfile";
import { fire } from "~/feedback/fire";
import { cachedIdentity } from "~/lib/account/identity-cache";
import { useAccount } from "~/lib/account/provider";
import { useTermsGate } from "~/lib/account/terms-gate";
import { ROUTES } from "~/lib/constants/routes";
import { useHideBalances } from "~/lib/hide-balances";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { FONT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { PrivacyMark, usePrivacyMark } from "./PrivacyMark";

/** U04-S01 / U14-S19: black identity header, overlapping white balance and quiet money actions. */
export function HomeBalance() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const { profile } = useOwnProfile();
  // Refresh the remembered identity without asking for a signing session on Home.
  useMMKVString(STORAGE_KEYS.identityCache, storage);
  const handle = profile.kind === "ready" ? profile.identity?.handle : cachedIdentity(address)?.handle;
  const gate = useTermsGate();
  const practice = useNetwork().key === "testnet";
  const [hidden, setHidden] = useHideBalances();
  const [mark] = usePrivacyMark();
  const sheet = useBalanceSheet();
  const readable = sheet.status === "ready" && sheet.rows.some((row) => row.valueUsd6 !== undefined);
  if (!address) return null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.account, { backgroundColor: color.account, boxShadow: `0px -3px 18px 0px ${color.glow}` }]}>
        <Pressable
          onPress={() => router.navigate(ROUTES.card)}
          accessibilityRole="button"
          accessibilityLabel="Open Kinpaku card"
          style={[styles.cardLink, { borderColor: color.accountMuted }]}
        >
          <CreditCard size={SIZE.iconSm} color={color.onAccount} />
          <Text style={[TYPE.micro, { color: color.onAccount }]}>Kinpaku</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(ROUTES.accountProfile)}
          accessibilityRole="button"
          accessibilityLabel={handle ? `Edit @${handle}` : "Pick a username"}
          style={styles.identity}
        >
          <Text numberOfLines={1} style={[TYPE.row, { color: color.onAccount }]}>
            {handle ? `@${handle}` : "Pick a username"}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.balance, { backgroundColor: color.card }]}>
        <View style={styles.heading}>
          <View style={styles.title}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>Balance</Text>
            <Pressable
              onPress={() => router.push(ROUTES.balanceDetails)}
              accessibilityRole="button"
              accessibilityLabel="Balance breakdown"
              style={styles.icon}
            >
              <Info size={SIZE.iconSm} color={color.ink} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push(ROUTES.displayBalance)}
            accessibilityRole="button"
            accessibilityLabel="Display Balance settings"
            style={styles.icon}
          >
            <Eye size={SIZE.iconSm} color={color.ink} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            fire("tick");
            setHidden(!hidden);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            hidden
              ? "Balance hidden. Show balance"
              : readable
                ? `Balance ${sheet.partial ? "about " : ""}${usd(sheet.totalUsd6)}. Hide balance`
                : "Balance loading"
          }
          style={styles.amount}
        >
          {hidden ? (
            <PrivacyMark name={mark} size={56} />
          ) : readable ? (
            <AmountHero
              text={usd(sheet.totalUsd6)}
              partial={sheet.partial}
              role={{ ...TYPE.displayBalance, fontFamily: FONT.display, fontSize: 56, lineHeight: 66 }}
              decimalRole={TYPE.numMd}
            />
          ) : sheet.status === "loading" ? (
            <Skeleton width={180} height={56} />
          ) : (
            <Text style={[TYPE.row, { color: color.text3 }]}>Balance unavailable</Text>
          )}
        </Pressable>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {practice ? "Paper money · Practice" : "Your assets, trades and pool equity"}
          {sheet.partial && !hidden ? " · Some values unavailable" : ""}
        </Text>
        <View style={styles.actions}>
          <Button
            label="Add funds"
            variant="secondary"
            style={styles.action}
            onPress={() => gate(() => router.push(ROUTES.addMoney), { verb: "add money", next: ROUTES.addMoney })}
          />
          <Button
            label="Withdraw"
            variant="secondary"
            style={styles.action}
            onPress={() => gate(() => router.push(ROUTES.withdraw), { verb: "send", next: ROUTES.withdraw })}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingTop: SPACE.sm },
  account: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 82,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  cardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.sm,
    minHeight: 28,
  },
  identity: { flexShrink: 1, minHeight: SIZE.touch, justifyContent: "flex-start", paddingTop: SPACE.xs },
  balance: {
    marginTop: -32,
    borderRadius: 34,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
    gap: SPACE.sm,
  },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  icon: { minWidth: SIZE.touch, minHeight: SIZE.touch, alignItems: "center", justifyContent: "center" },
  amount: { minHeight: 70, justifyContent: "center", alignItems: "flex-start" },
  actions: { flexDirection: "row", gap: SPACE.sm, paddingTop: SPACE.md },
  action: { flex: 1 },
});
