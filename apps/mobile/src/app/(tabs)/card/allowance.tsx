import { ONE_USD6 } from "@senryo/core";
import { allowanceState, useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { ReadingView } from "~/components/kit/states";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { CARD_LIMIT_CHIPS_USD } from "~/features/card/constants";
import { SpendLimit } from "~/features/card/SpendLimit";
import { ALLOWANCE_DAYS, useCardAllowance } from "~/features/card/useCardAllowance";
import { OutcomeNote, useOutcome } from "~/features/trade/OutcomeNote";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000n;

/**
 * The Kinpaku daily limit (D-032), on the real onchain allowance: what it is now, a new limit from four presets set
 * with a fresh passkey check (a signed `SpendAllowance` for `ALLOWANCE_DAYS` days), and Freeze, which revokes it at once.
 * The limit only ever draws on Free to spend; positions' margin is out of its reach.
 */
export default function AllowanceScreen() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const [pick, setPick] = useState<bigint>(CARD_LIMIT_CHIPS_USD[1]);
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const card = useCardAllowance(snapshot);
  const network = useNetwork();
  const guard = useReviewGuard([network.chainId, address, pick].join(":"));
  const { outcome, unresolved } = useOutcome(card.trace.events);
  // An unconfirmed signed change keeps both actions locked: a second one could race the first.
  const busy = card.trace.running || unresolved;
  if (!address) {
    return (
      <Screen contentStyle={styles.page}>
        <Stack.Screen options={{ title: "Spend limit" }} />
        <Text style={[TYPE.body, { color: color.text2 }]}>Create an account to set a spend limit.</Text>
        <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
      </Screen>
    );
  }
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Spend limit" }} />
      <ReadingView reading={risk} loading="plate" loadingLabel="Reading your limit">
        {(s) => {
          const live =
            allowanceState(
              s.allowanceDailyLimit,
              s.allowanceExpiry,
              s.allowanceLeft,
              BigInt(Date.now()) / MS_PER_SECOND,
            ).kind === "live";
          return (
            <View style={styles.page}>
              <SpendLimit snapshot={s} />
              <Text style={[TYPE.body, { color: color.text2 }]}>
                Kinpaku can only spend from Free to spend, and never more than this each day. A new limit lasts{" "}
                {String(ALLOWANCE_DAYS)} days.
              </Text>
              <Segmented
                options={CARD_LIMIT_CHIPS_USD.map((l) => ({ value: String(l), label: usd(l * ONE_USD6, 0) }))}
                value={String(pick)}
                onChange={(v) => setPick(BigInt(v))}
                label="Daily limit"
              />
              <HoldToConfirm
                resetKey={[network.chainId, address, pick].join(":")}
                label={busy ? "Working…" : `Set ${usd(pick * ONE_USD6, 0)} a day`}
                disabled={busy || !card.ready}
                onConfirm={() => void card.setLimit(pick * ONE_USD6, guard)}
              />
              {live ? (
                <Button
                  label="Freeze the card"
                  variant="destructive"
                  disabled={busy || !card.ready}
                  onPress={() => void card.freeze()}
                />
              ) : null}
              {card.trace.running ? null : <OutcomeNote outcome={outcome} thing="limit change" success={card.done} />}
            </View>
          );
        }}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
});
