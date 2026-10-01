/**
 * Withdraw to your own wallet (D-039; in session scope): pick AUSD or USDC, a share of what can leave, and confirm.
 * What can leave is the lower of that token's balance and Free to trade (`maxWithdrawable`; the core re-checks). The
 * destination is the account's own address — the same passkey keeps the funds — so no extra check is asked. The
 * amount is typed exactly (presets fill it, review S02); once sent, the screen is the receipt of what was signed, on
 * the shared outcome contract — a signed withdrawal still unknown is never "nothing moved" (S01) — until "Withdraw
 * again" starts a fresh draft (S06).
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import { type CollateralSymbol, maxWithdrawable, useQueryEnv, useSendTrace, withdrawRequest } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AmountEntry } from "./AmountEntry";
import { useAmountDraft } from "./amount-draft";
import { type ExecutedMove, MoneyReceipt } from "./MoneyReceipt";
import { WITHDRAW_WORDS } from "./words";

const TOKENS = [
  { value: "AUSD", label: "AUSD" },
  { value: "USDC", label: "USDC" },
] as const satisfies readonly { value: CollateralSymbol; label: string }[];

export function WithdrawToSelf({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const trace = useSendTrace();
  const gas = useEnsureGas();
  const address = account.hint?.address;
  const [symbol, setSymbol] = useState<CollateralSymbol>(snapshot.ausd >= snapshot.usdc ? "AUSD" : "USDC");
  const max = maxWithdrawable(snapshot, symbol);
  const draft = useAmountDraft(max);
  /** The withdrawal as it was signed — frozen, so a balance refresh never changes what the receipt says. */
  const [executed, setExecuted] = useState<ExecutedMove>();
  const amount = draft.amount;
  const held = symbol === "AUSD" ? snapshot.ausd : snapshot.usdc;
  const practice = network.key === "testnet";
  const ready = amount > 0n && !draft.over && account.client !== undefined;
  const send = async () => {
    const client = account.client;
    if (!client || !address || !ready) return;
    const request = withdrawRequest(env.chainId, symbol, amount, address, positionCount(snapshot.positionBitmap));
    setExecuted({
      amount,
      symbol,
      chainId: env.chainId,
      to: `Your wallet · ${shortAddress(address)}`,
      network: network.name,
      practice,
    });
    await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
    });
  };

  // Once it is out, the screen is its receipt until it settles: no second withdrawal beside an unresolved one.
  if (executed && (trace.running || trace.events.length > 0)) {
    return (
      <MoneyReceipt
        move={executed}
        events={trace.events}
        running={trace.running}
        words={WITHDRAW_WORDS}
        onAgain={(fresh) => {
          trace.reset();
          setExecuted(undefined);
          if (fresh) draft.reset();
        }}
        onLeave={() => router.back()}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Segmented options={TOKENS} value={symbol} onChange={setSymbol} label="Token" />
      <AmountEntry draft={draft} max={max} symbol={symbol} label="Amount to withdraw" />
      <Panel style={styles.rows}>
        <MarkedLine
          id={collateralId(env.chainId, symbol)}
          label={`${symbol} in your account`}
          value={usd(held)}
          size={SIZE.markToken}
        />
        <KeyValue label="Free to trade" value={usd(snapshot.freeToTrade > 0n ? snapshot.freeToTrade : 0n)} />
        <KeyValue label="To" value={address ? `Your wallet · ${shortAddress(address)}` : "—"} />
        <KeyValue label="Network" value={network.name} />
      </Panel>
      {max < held ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          The rest backs your open positions and holds; it can leave once they close.
        </Text>
      ) : null}
      <Button
        label={amount > 0n ? `Withdraw ${usd(amount)} to your wallet` : "Withdraw to your wallet"}
        disabled={!ready}
        onPress={() => void send()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  hero: { gap: SPACE.xs },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
