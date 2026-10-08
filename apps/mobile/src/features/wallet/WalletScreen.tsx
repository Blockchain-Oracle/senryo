/**
 * The Wallet (S5.12; pivot "Practice sheet"): the balance, then Get test dollars (granted at sign-up, topped up once a
 * day), Receive and Withdraw. The Real methods — any chain through Aurora, USDC on Monad, Pay with MON — stay visible
 * and locked ("Real money only") until Real opens (S9); nothing here fakes a deposit.
 */
import { formatUnits } from "@senryo/core";
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { ArrowUp, Coins, Globe, Lock, QrCode, Wallet } from "~/components/kit/symbols";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { SettingsRow } from "~/features/profile/SettingsRow";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { ROUTES } from "~/lib/constants/routes";
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
  const account = useMarketAccount(owner);
  const session = useSessionRunner();
  const grant = usePracticeGrant(owner, session);
  const balance = "value" in account ? account.value.balance : undefined;
  const text = balance === undefined ? "$—" : `$${formatUnits(balance, DOLLAR_DECIMALS, CENTS)}`;

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
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>Practice · Test USD</Text>
          <AmountHero text={text} accessibilityLabel={`Practice balance ${text}`} />
        </View>
        <View>
          <SettingsRow
            title={grant.isPending ? "Adding test dollars…" : "Get test dollars"}
            icon={Coins}
            tint={color.up}
            {...(grant.isPending ? {} : { onPress: getDollars })}
          />
          <SettingsRow title="Receive" icon={QrCode} onPress={() => router.push(ROUTES.receive)} />
          <SettingsRow title="Withdraw" icon={ArrowUp} onPress={() => router.push(ROUTES.withdraw)} />
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
  fill: { flex: 1 },
  content: { padding: SIZE.gutter, gap: SPACE.xl },
  hero: { gap: SPACE.xs },
});
