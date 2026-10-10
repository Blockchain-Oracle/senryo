/**
 * The Wallet (S5.12; pivot "Practice sheet"): the balance, then Get test dollars (granted at sign-up, topped up once a
 * day), Receive and Withdraw. The Real methods — any chain through Aurora, USDC on Monad, Pay with MON — stay visible
 * and locked ("Real money only") until Real opens (S9); nothing here fakes a deposit.
 */
import { formatUnits } from "@senryo/core";
import { dollarId } from "@senryo/identity";
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { AmountHero } from "~/components/kit/AmountHero";
import { ArrowUp, Coins, Globe, Lock, QrCode, Wallet } from "~/components/kit/symbols";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { SettingsRow } from "~/features/profile/SettingsRow";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { type AccountVerb, accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const MS_PER_SECOND = 1_000;

const nextGrantText = (nextAt: number | null) =>
  nextAt
    ? `Next top-up ${new Date(nextAt * MS_PER_SECOND).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Topped up";

export function WalletScreen() {
  const { color } = useTheme();
  const owner = useAccount().hint?.address;
  const network = useNetwork();
  const account = useMarketAccount(owner);
  const session = useSessionRunner();
  const grant = usePracticeGrant(owner, session);
  const balance = "value" in account ? account.value.balance : undefined;
  const text = balance === undefined ? "$—" : `$${formatUnits(balance, DOLLAR_DECIMALS, CENTS)}`;

  // A guest sees the wallet read-only (R2.14): each action asks for an account first.
  const ask = (verb: AccountVerb) => () => router.push(accountRequiredRoute(verb, "/wallet"));
  const getDollars = () => {
    fire("tick");
    grant.mutate(undefined, {
      onSuccess: (r) => {
        if (r.state === "granted") {
          fire("confirm", { sound: "deposit" });
          notify({
            title: `+$${formatUnits(r.amount, DOLLAR_DECIMALS, CENTS)} test dollars`,
            description: "Added to Practice.",
          });
        } else if (r.state === "already")
          notify({ title: "Already topped up today", description: nextGrantText(r.nextAt) });
        else notify({ title: "Test dollars are unavailable", description: "Try again later.", tone: "warning" });
      },
      onError: (e) => notify({ title: "Couldn't add test dollars", description: e.message, tone: "warning" }),
    });
  };

  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.dollar}>
            <EntityMark id={dollarId(network.chainId)} size={SIZE.markInline} decorative />
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {network.modeLabel} · {network.key === "testnet" ? "Test USD" : "USDC"}
            </Text>
          </View>
          <AmountHero text={text} accessibilityLabel={`${network.modeLabel} balance ${text}`} />
          {/* "$—" alone reads as loading forever: say why there is no figure (R2 simulator pass). */}
          {!owner || account.status === "failed" ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {owner ? "Your balance didn't load · trying again" : "Sign in to see your balance"}
            </Text>
          ) : null}
        </View>
        <View>
          <SettingsRow
            title={grant.isPending ? "Adding test dollars…" : "Get test dollars"}
            icon={Coins}
            tint={color.ink}
            {...(grant.isPending ? {} : { onPress: owner ? getDollars : ask("add money") })}
          />
          <SettingsRow
            title="Receive"
            icon={QrCode}
            onPress={owner ? () => router.push(ROUTES.receive) : ask("add money")}
          />
          <SettingsRow
            title="Withdraw"
            icon={ArrowUp}
            onPress={owner ? () => router.push(ROUTES.withdraw) : ask("send")}
          />
        </View>
        <View>
          <SectionHeading detail="Opens with Real">Add real money</SectionHeading>
          <SettingsRow title="From any chain" icon={Globe} control={<Lock size={SIZE.iconSm} color={color.text3} />} />
          <SettingsRow title="USDC on Monad" icon={Wallet} control={<Lock size={SIZE.iconSm} color={color.text3} />} />
          <SettingsRow title="Pay with MON" icon={Coins} control={<Lock size={SIZE.iconSm} color={color.text3} />} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dollar: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  fill: { flex: 1 },
  content: { padding: SIZE.gutter, gap: SPACE.xl },
  hero: { gap: SPACE.xs },
});
