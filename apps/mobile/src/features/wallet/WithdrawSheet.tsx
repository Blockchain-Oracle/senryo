/**
 * Withdraw (S5.12; the full money-action contract): a recipient (pasted or typed, checked), an exact amount with Max as
 * a convenience, a review that freezes the request, one Face ID signing an EIP-3009 transfer the relay submits (no MON
 * needed), and a receipt that stays until "Send again". A failure says so and moved nothing. The check and the send are
 * `@senryo/calls` (`checkWithdraw`, `useWithdrawFlow`), the web's too.
 */

import { checkWithdraw, useWithdrawFlow } from "@senryo/calls/react";
import { explorerTxUrl } from "@senryo/config";
import { formatUnits, shortAddress } from "@senryo/core";
import { useMarketAccount, useQueryEnv } from "@senryo/query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

type Stage =
  | { kind: "edit" }
  | { kind: "review"; to: `0x${string}`; value: bigint }
  | { kind: "sending"; to: `0x${string}`; value: bigint }
  | { kind: "sent"; to: `0x${string}`; value: bigint; txHash: string }
  | { kind: "failed"; message: string };

export function WithdrawSheet({ onClose }: { onClose: () => void }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const caller = useAccount();
  const owner = caller.hint?.address;
  const account = useMarketAccount(owner);
  const balance = "value" in account ? account.value.balance : undefined;
  const flow = useWithdrawFlow(caller);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "edit" });
  // A field can't elide: while not being edited, the address shows on one line with its middle elided.
  const [editingTo, setEditingTo] = useState(false);

  const { to: dest, value, ok, problem } = checkWithdraw(to, amount, owner, balance);

  const send = async (target: `0x${string}`, v: bigint) => {
    setStage({ kind: "sending", to: target, value: v });
    try {
      const result = await flow.send(target, v);
      if (result.state === "cancelled") {
        setStage({ kind: "review", to: target, value: v });
        return;
      }
      fire("confirm", { sound: "send" });
      setStage({ kind: "sent", to: target, value: v, txHash: result.txHash });
    } catch (error) {
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
            <View style={[styles.field, { backgroundColor: color.raised2 }]}>
              {editingTo || to === "" ? (
                <TextInput
                  value={to}
                  onChangeText={setTo}
                  onFocus={() => setEditingTo(true)}
                  onBlur={() => setEditingTo(false)}
                  autoFocus={editingTo}
                  placeholder="0x… recipient"
                  placeholderTextColor={color.text3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[TYPE.body, styles.input, { color: color.ink }]}
                  accessibilityLabel="Recipient address"
                />
              ) : (
                <Pressable
                  style={[styles.input, styles.shown]}
                  onPress={() => setEditingTo(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Recipient ${to}. Edit`}
                >
                  <Text style={[TYPE.body, { color: color.ink }]} numberOfLines={1} ellipsizeMode="middle">
                    {to}
                  </Text>
                </Pressable>
              )}
              <Button
                label="Paste"
                variant="ghost"
                size="sm"
                block={false}
                onPress={async () => setTo((await Clipboard.getStringAsync()).trim())}
              />
            </View>
            <View style={[styles.field, { backgroundColor: color.raised2 }]}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={color.text3}
                keyboardType="decimal-pad"
                style={[TYPE.numLg, styles.input, { color: color.ink }]}
                accessibilityLabel="Amount in dollars"
              />
              <Button
                label="Max"
                variant="ghost"
                size="sm"
                block={false}
                disabled={balance === undefined}
                onPress={() =>
                  balance !== undefined && setAmount(formatUnits(balance, DOLLAR_DECIMALS, DOLLAR_DECIMALS))
                }
              />
            </View>
            {problem ? <Text style={[TYPE.caption, { color: color.down }]}>{problem}</Text> : null}
            <Button
              label="Review"
              disabled={!ok}
              onPress={() => dest && value !== undefined && setStage({ kind: "review", to: dest, value })}
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
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: SIZE.touch + SPACE.sm,
    borderRadius: SPACE.md,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
  },
  input: { flex: 1, minHeight: SIZE.touch },
  shown: { justifyContent: "center" },
});
