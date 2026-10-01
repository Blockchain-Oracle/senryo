/**
 * Send to someone else (FT058/C38, P22; direction §9): recipient → amount → review → a fresh passkey check → the send.
 * The recipient is an address or an @handle resolved on this network; the review always shows the full resolved
 * address, the token, the network and the mode before anything is signed. A send outside the account is outside the
 * session's scope, so it runs behind a step-up (`requestStepUp` → `account.stepUp`, a one-shot signer). What can leave
 * is the lower of the token's balance and Free to trade; the core re-checks. The result is said once finalized.
 */
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { RISK } from "@senryo/core";
import { collateralId } from "@senryo/identity";
import { type CollateralSymbol, maxWithdrawable, useQueryEnv, useSendTrace, withdrawRequest } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { COLLATERAL_STEPS_BPS as SHARES_BPS } from "~/features/portfolio/constants";
import { type FieldTone, SetupField } from "~/features/setup/SetupField";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { readClipboard } from "~/lib/clipboard";
import { ROUTES } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { type Recipient, useRecipient } from "./useRecipient";

const TOKENS = [
  { value: "AUSD", label: "AUSD" },
  { value: "USDC", label: "USDC" },
] as const satisfies readonly { value: CollateralSymbol; label: string }[];
const RECIPIENT_MAX = 64;

function recipientLine(r: Recipient, self: boolean): { message?: string; tone: FieldTone } {
  switch (r.status) {
    case "empty":
      return { tone: "quiet" };
    case "invalid":
      return { message: "Enter a full 0x address or an @handle", tone: "bad" };
    case "resolving":
      return { message: "Looking it up…", tone: "quiet" };
    case "not-found":
      return { message: `@${r.handle} isn’t on this network`, tone: "bad" };
    case "failed":
      return { message: "Couldn’t look that up. Check your connection.", tone: "bad" };
    case "ready":
      return self
        ? { message: "That’s your own address: use Withdraw instead", tone: "bad" }
        : { message: r.handle ? `@${r.handle} · ${r.address}` : "A Monad address", tone: "good" };
  }
}

export function SendToAddress({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const trace = useSendTrace();
  const gas = useEnsureGas();
  const me = account.hint?.address;
  const [input, setInput] = useState("");
  const recipient = useRecipient(input);
  const [symbol, setSymbol] = useState<CollateralSymbol>(snapshot.ausd >= snapshot.usdc ? "AUSD" : "USDC");
  const [shareBps, setShareBps] = useState<bigint>(SHARES_BPS[0]);
  const [sent, setSent] = useState<{ amount: bigint; symbol: CollateralSymbol; to: string }>();
  const max = maxWithdrawable(snapshot, symbol);
  const amount = (max * shareBps) / RISK.BPS;
  const self = recipient.status === "ready" && me !== undefined && recipient.address.toLowerCase() === me.toLowerCase();
  const line = recipientLine(recipient, self);
  const ready = recipient.status === "ready" && !self && amount > 0n;
  const practice = network.key === "testnet";
  const busy = trace.running;
  const last = trace.events.at(-1)?.stage;

  const send = async () => {
    if (recipient.status !== "ready" || !account.client) return;
    const to = recipient.address;
    const name = recipient.handle ? `@${recipient.handle}` : shortAddress(to);
    const request = withdrawRequest(env.chainId, symbol, amount, to, positionCount(snapshot.positionBitmap));
    setSent({ amount, symbol, to: name });
    await requestStepUp(
      {
        title: `Send ${usd(amount)} ${symbol}`,
        detail: `To ${recipient.handle ? `@${recipient.handle} · ` : ""}${to} on ${network.name}${practice ? " (practice money)" : ""}. Sends outside your account always ask for a fresh passkey check.`,
        confirmLabel: "Send with passkey",
      },
      () => account.stepUp((signer) => trace.run(stepUpSender(signer), request, { preflight: gas.preflight(request) })),
    );
  };

  return (
    <View style={styles.stack}>
      <SetupField
        label="Recipient, an address or @handle"
        value={input}
        onChangeText={setInput}
        placeholder="Address or @handle"
        action={
          input
            ? { label: "Clear", onPress: () => setInput("") }
            : {
                label: "Paste",
                onPress: () => void readClipboard().then((t) => setInput(t.trim().slice(0, RECIPIENT_MAX))),
              }
        }
        {...(line.message ? { message: line.message } : {})}
        tone={line.tone}
        input={{ autoCapitalize: "none", maxLength: RECIPIENT_MAX, returnKeyType: "done" }}
      />
      <View style={styles.hero}>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>You send</Text>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[TYPE.displayBalance, { color: color.ink }]}
        >
          {usd(amount)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          {symbol}
          {practice ? " · test token" : ""} · up to {usd(max)} can leave now
        </Text>
      </View>
      <Segmented options={TOKENS} value={symbol} onChange={setSymbol} label="Token" />
      <Segmented
        options={SHARES_BPS.map((b) => ({ value: String(b), label: b >= RISK.BPS ? "All" : pct(b) }))}
        value={String(shareBps)}
        onChange={(v) => setShareBps(BigInt(v))}
        label="How much"
      />
      <Panel style={styles.rows}>
        <MarkedLine id={collateralId(env.chainId, symbol)} label={symbol} value={usd(amount)} size={SIZE.markToken} />
        <KeyValue
          label="To"
          value={
            recipient.status === "ready" && !self
              ? recipient.handle
                ? `@${recipient.handle}`
                : shortAddress(recipient.address)
              : "—"
          }
        />
        <KeyValue label="Network" value={network.name} />
        <KeyValue label="Money" value={practice ? "Practice · paper money" : "Mainnet · real money"} />
      </Panel>
      {last === "finalized" && !busy && sent ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, { color: color.up }]}>
          {usd(sent.amount)} {sent.symbol} sent to {sent.to} · finalized.
        </Text>
      ) : last === "failed" || last === "reverted" ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down }]}>
          That didn’t go through; nothing moved.
        </Text>
      ) : null}
      <Button
        label={busy ? "Sending…" : "Review and send"}
        loading={busy}
        disabled={busy || !ready}
        onPress={() => {
          fire("press");
          void send();
        }}
      />
      {self ? (
        <Button
          label="Withdraw to my wallet"
          variant="ghost"
          size="sm"
          onPress={() => router.replace(ROUTES.withdraw)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  hero: { gap: SPACE.xs },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.xs },
});
