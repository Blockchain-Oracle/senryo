/**
 * Withdraw (S5.12; the full money-action contract): a recipient (pasted or typed, checked), an exact amount with Max as
 * a convenience, a review that freezes the request, one Face ID signing an EIP-3009 transfer the relay submits (no MON
 * needed), and a receipt that stays until "Send again". A failure says so and moved nothing.
 */

import { classifyAuthError, isSilent } from "@senryo/account";
import { freshAuthNonce, transferAuthRequest } from "@senryo/chain";
import { explorerTxUrl } from "@senryo/config";
import { formatUnits, parseUnits, shortAddress } from "@senryo/core";
import { useQueryEnv, useWithdraw } from "@senryo/query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const AUTH_TTL_SEC = 3_600;
const MS_PER_SECOND = 1_000;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

type Stage =
  | { kind: "edit" }
  | { kind: "review"; to: `0x${string}`; value: bigint }
  | { kind: "sending"; to: `0x${string}`; value: bigint }
  | { kind: "sent"; to: `0x${string}`; value: bigint; txHash: string }
  | { kind: "failed"; message: string };

export function WithdrawSheet({ balance, onClose }: { balance: bigint | undefined; onClose: () => void }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const { client, hint } = useAccount();
  const owner = hint?.address;
  const withdraw = useWithdraw(owner);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "edit" });

  const parsed = parseUnits(amount, DOLLAR_DECIMALS);
  const value = parsed.ok ? parsed.value : undefined;
  const toOk = ADDRESS.test(to.trim()) && to.trim().toLowerCase() !== owner?.toLowerCase();
  const enough = value !== undefined && balance !== undefined && value > 0n && value <= balance;
  const problem = !to
    ? null
    : !toOk
      ? "Enter a Monad address (0x…) other than yours"
      : amount && !parsed.ok
        ? "Enter an amount like 12.50"
        : value !== undefined && balance !== undefined && value > balance
          ? `You have $${formatUnits(balance, DOLLAR_DECIMALS, CENTS)}`
          : null;

  const send = async (dest: `0x${string}`, v: bigint) => {
    if (!client || !owner) return;
    setStage({ kind: "sending", to: dest, value: v });
    try {
      const authorization = {
        from: owner,
        to: dest,
        value: v,
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / MS_PER_SECOND) + AUTH_TTL_SEC),
        nonce: freshAuthNonce(),
      };
      const signature = await client.stepUp(
        (signer) => signer.signTypedData(transferAuthRequest(env.chainId, authorization)),
        `Send $${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`,
      );
      const result = await withdraw.mutateAsync({ authorization, signature });
      if (result.state === "reverted") throw new Error("The transfer was refused on chain. Nothing moved.");
      fire("confirm", { sound: "send" });
      setStage({ kind: "sent", to: dest, value: v, txHash: result.txHash });
    } catch (error) {
      if (isSilent(classifyAuthError(error))) {
        setStage({ kind: "review", to: dest, value: v });
        return;
      }
      fire("fail");
      setStage({ kind: "failed", message: (error as Error).message });
    }
  };

  return (
    <Sheet onClose={onClose} closeLabel="Close withdraw" dismissible={stage.kind !== "sending"}>
      <SheetHeading title="Withdraw" body="Test USD to a Monad address" />
      <View style={styles.body}>
        {stage.kind === "edit" ? (
          <>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="0x… recipient"
              placeholderTextColor={color.text3}
              autoCapitalize="none"
              autoCorrect={false}
              style={[TYPE.body, styles.input, { color: color.ink, backgroundColor: color.raised2 }]}
              accessibilityLabel="Recipient address"
            />
            <Button
              label="Paste"
              variant="ghost"
              size="sm"
              block={false}
              onPress={async () => setTo((await Clipboard.getStringAsync()).trim())}
            />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={color.text3}
              keyboardType="decimal-pad"
              style={[TYPE.numLg, styles.input, { color: color.ink, backgroundColor: color.raised2 }]}
              accessibilityLabel="Amount in dollars"
            />
            <Button
              label="Max"
              variant="ghost"
              size="sm"
              block={false}
              disabled={balance === undefined}
              onPress={() => balance !== undefined && setAmount(formatUnits(balance, DOLLAR_DECIMALS, DOLLAR_DECIMALS))}
            />
            {problem ? <Text style={[TYPE.caption, { color: color.down }]}>{problem}</Text> : null}
            <Button
              label="Review"
              disabled={!toOk || !enough}
              onPress={() => value !== undefined && setStage({ kind: "review", to: to.trim() as `0x${string}`, value })}
            />
          </>
        ) : stage.kind === "review" || stage.kind === "sending" ? (
          <>
            <Text style={[TYPE.title, { color: color.ink }]}>
              ${formatUnits(stage.value, DOLLAR_DECIMALS, CENTS)} to {shortAddress(stage.to)}
            </Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>No fee · arrives in a few seconds · Face ID</Text>
            <Button
              label="Send"
              loading={stage.kind === "sending"}
              disabled={stage.kind === "sending"}
              onPress={() => void send(stage.to, stage.value)}
            />
            {stage.kind === "review" ? (
              <Button label="Edit" variant="ghost" onPress={() => setStage({ kind: "edit" })} />
            ) : null}
          </>
        ) : stage.kind === "sent" ? (
          <>
            <Text style={[TYPE.title, { color: color.ink }]}>
              Sent ${formatUnits(stage.value, DOLLAR_DECIMALS, CENTS)} to {shortAddress(stage.to)}
            </Text>
            <Button
              label="View transaction"
              variant="secondary"
              onPress={() => void Linking.openURL(explorerTxUrl(env.chainId, stage.txHash))}
            />
            <Button
              label="Send again"
              variant="ghost"
              onPress={() => {
                setAmount("");
                setStage({ kind: "edit" });
              }}
            />
          </>
        ) : (
          <>
            <Text style={[TYPE.title, { color: color.ink }]}>Not sent</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{stage.message}</Text>
            <Button label="Try again" onPress={() => setStage({ kind: "edit" })} />
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg },
  input: { minHeight: SIZE.touch + SPACE.sm, borderRadius: SPACE.md, paddingHorizontal: SPACE.md },
});
