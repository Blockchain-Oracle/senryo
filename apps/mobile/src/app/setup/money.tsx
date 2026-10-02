import { useStarterStatus } from "@senryo/query";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChevronRight, Coins, CreditCard, Globe } from "~/components/kit/symbols";
import { SheetRow } from "~/components/sheet/SheetRow";
import { PracticeMoneyCard, starterLine } from "~/features/setup/PracticeMoneyCard";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { VoucherField } from "~/features/setup/VoucherField";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useStarter } from "~/lib/account/use-starter";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";

/** The credited amount stays on screen this long before the step moves on. */
const CREDITED_HOLD_MS = 1_200;

/**
 * Setup step 3 — money (A2, B15). Practice: one big "Get P$100" card (paper money, no real value); "Have a code?"
 * swaps in the voucher field. Mainnet: the Add-money rows — card or bank, crypto on Monad, another chain — and Later.
 * A claim or voucher is signed in-session, the sponsor pays the network fee, and neither is ever re-sent by itself.
 */
export default function MoneyStep() {
  const network = useNetwork();
  return network.key === "mainnet" ? <MainnetMoney /> : <PracticeMoney />;
}

function PracticeMoney() {
  const { next, back } = useSetupNav("money");
  const address = useAccount().hint?.address;
  const starter = useStarter();
  const status = useStarterStatus(address);
  const amount = status.data ? usd(status.data.practiceUsd6, 0) : undefined;
  const [code, setCode] = useState(false);
  const { phase } = starter;
  const credited = phase.kind === "done";
  useEffect(() => {
    if (!credited) return;
    fire("confirm");
    const id = setTimeout(next, CREDITED_HOLD_MS);
    return () => clearTimeout(id);
  }, [credited, next]);

  if (code) return <VoucherField onBack={() => setCode(false)} onDone={next} back={back} />;
  const finished = phase.kind === "claimed" || phase.kind === "done";
  const busy = ["checking", "signing", "sending", "settling"].includes(phase.kind);
  return (
    <SetupScreen
      step="money"
      title="Your practice money"
      body="Paper dollars for every trade"
      onBack={back}
      onSkip={next}
      footer={
        <>
          {finished ? null : (
            <Button label="Have a code?" variant="ghost" size="sm" disabled={busy} onPress={() => setCode(true)} />
          )}
          {finished ? (
            <Button label="Continue" onPress={next} />
          ) : phase.kind === "pending" || phase.kind === "unchecked" ? (
            <Button label="Check status" variant="secondary" onPress={starter.recheck} />
          ) : (
            <Button
              label={phase.kind === "failed" ? "Try again" : amount ? `Get ${amount}` : "Get practice money"}
              loading={busy}
              disabled={!starter.ready}
              onPress={() => void starter.claim()}
            />
          )}
        </>
      }
    >
      <PracticeMoneyCard amount={amount} line={starterLine(phase)} credited={finished} />
    </SetupScreen>
  );
}

function MainnetMoney() {
  const { color } = useTheme();
  const { next, back } = useSetupNav("money");
  const chevron = <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />;
  const open = (href: string) => router.push(href as Href);
  const icon = (Glyph: typeof Coins) => <Glyph size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />;
  return (
    <SetupScreen
      step="money"
      title="Add money"
      body="Any amount, whenever you like"
      onBack={back}
      onSkip={next}
      footer={<Button label="Later" variant="secondary" onPress={next} />}
    >
      <View style={styles.rows}>
        <SheetRow
          index={0}
          title="Card or bank"
          detail="Buy with Ramp"
          leading={icon(CreditCard)}
          trailing={chevron}
          onPress={() => open(ROUTES.addMoney)}
        />
        <SheetRow
          index={1}
          title="Crypto on Monad"
          detail="Your address"
          leading={icon(Coins)}
          trailing={chevron}
          onPress={() => open(ROUTES.receive)}
        />
        <SheetRow
          index={2}
          title="Another chain"
          detail="Bridge in"
          leading={icon(Globe)}
          trailing={chevron}
          onPress={() => open(ROUTES.addMoney)}
        />
      </View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: SPACE.sm },
});
