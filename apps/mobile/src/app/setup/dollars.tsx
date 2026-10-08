import { formatUnits } from "@senryo/core";
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { SPACE } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

/**
 * Setup — test dollars (pivot onboarding step 5): Practice dollars are granted the moment this page opens (the relay
 * mints them gas-free), with the deposit sound; an account that already has them is shown its balance. A failure says
 * so and offers one retry; nothing here blocks setup.
 */
export default function DollarsStep() {
  const { next, address } = useSetupNav("dollars");
  const session = useSessionRunner();
  const grant = usePracticeGrant(address, session);
  const account = useMarketAccount(address);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !session || !address) return;
    asked.current = true;
    grant.mutate(undefined, {
      onSuccess: (r) => {
        if (r.state === "granted") fire("confirm", { sound: "deposit" });
      },
    });
  }, [session, address, grant]);

  const result = grant.data;
  const amount = result?.state === "granted" ? result.amount : "value" in account ? account.value.balance : undefined;
  const text = amount === undefined ? "$—" : `$${formatUnits(amount, DOLLAR_DECIMALS, CENTS)}`;
  const body = grant.isPending
    ? "Adding your test dollars"
    : grant.isError
      ? "Couldn't add them just now"
      : result?.state === "already"
        ? "Already in your Practice balance"
        : "Free test dollars to call with";

  return (
    <SetupScreen
      step="dollars"
      title="Test dollars"
      body={body}
      onSkip={next}
      footer={
        grant.isError ? (
          <View style={styles.footer}>
            <Button label="Try again" variant="secondary" onPress={() => grant.mutate()} />
            <Button label="Continue" onPress={next} />
          </View>
        ) : (
          <Button label="Continue" onPress={next} loading={grant.isPending} disabled={grant.isPending} />
        )
      }
    >
      <AmountHero text={text} accessibilityLabel={`Practice balance ${text}`} />
    </SetupScreen>
  );
}

const styles = StyleSheet.create({ footer: { gap: SPACE.sm } });
