/**
 * Send to someone else (FT058/C38, P22; direction §9): recipient → amount → review → a fresh passkey check → the send.
 * The recipient is an address or an @handle resolved on this network; the review always shows the full resolved
 * address, the token, the network and the mode before anything is signed. A send outside the account is outside the
 * session's scope, so it runs behind a step-up (`requestStepUp` → `account.stepUp`, a one-shot signer). What can leave
 * is the lower of the token's balance and Free to trade; the core re-checks. The amount is typed exactly (presets fill
 * it, review S02); the request is frozen when it goes to the passkey check, and the screen becomes its receipt — the
 * shared outcome contract, never "nothing moved" for a signed send that is still unknown (S01) — until a fresh draft
 * starts with "Send another" (S06).
 */

import { profileGetRoute } from "@senryo/api-client";
import type { AccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import {
  type CollateralSymbol,
  maxWithdrawable,
  operationKey,
  useQueryEnv,
  useSendTrace,
  walletTransferRequest,
  withdrawRequest,
} from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { type FieldTone, SetupField } from "~/features/setup/SetupField";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { readClipboard } from "~/lib/clipboard";
import { ROUTES } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
import { storage } from "~/lib/storage";
import { validateMoney } from "~/lib/validate-money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AmountEntry } from "./AmountEntry";
import { useAmountDraft } from "./amount-draft";
import { type ExecutedMove, MoneyReceipt, restoredMove } from "./MoneyReceipt";
import { RecentRecipients } from "./RecentRecipients";
import { type Recipient, useRecipient } from "./useRecipient";
import { SEND_WORDS } from "./words";

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

export function SendToAddress({
  snapshot,
  wallet,
  source = "trading",
}: {
  snapshot?: AccountSnapshot;
  wallet?: Record<CollateralSymbol, bigint>;
  source?: "wallet" | "trading";
}) {
  const { color } = useTheme();
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const trace = useSendTrace(operationKey(env.chainId, account.hint?.address, `send-${source}`));
  const gas = useEnsureGas();
  const me = account.hint?.address;
  const [savedRecipient, setSavedRecipient] = useMMKVString(
    `senryo.recipient.v1:${env.chainId}:${me}:${source}`,
    storage,
  );
  const input = savedRecipient ?? "";
  const setInput = (next: string) => setSavedRecipient(next);
  const recipient = useRecipient(input);
  const [symbol, setSymbol] = useState<CollateralSymbol>(
    (snapshot?.ausd ?? wallet?.AUSD ?? 0n) >= (snapshot?.usdc ?? wallet?.USDC ?? 0n) ? "AUSD" : "USDC",
  );
  const max = source === "wallet" ? (wallet?.[symbol] ?? 0n) : snapshot ? maxWithdrawable(snapshot, symbol) : 0n;
  const draft = useAmountDraft(max, `send:${env.chainId}:${me}:${source}:${symbol}`);
  /** The request as it went to the passkey check — frozen, so a balance refresh never changes what was sent. */
  const [executed, setExecuted] = useState<ExecutedMove>();
  const amount = draft.amount;
  const self = recipient.status === "ready" && me !== undefined && recipient.address.toLowerCase() === me.toLowerCase();
  const line = recipientLine(recipient, self);
  const ready = recipient.status === "ready" && !self && amount > 0n && !draft.over;
  const practice = network.key === "testnet";

  const guard = useReviewGuard(
    [
      env.chainId,
      account.hint?.address,
      source,
      symbol,
      amount,
      input,
      recipient.status === "ready" ? recipient.address : "",
    ].join(":"),
  );
  const send = async () => {
    if (recipient.status !== "ready" || !account.client || !me || !ready) return;
    const to = recipient.address;
    const request =
      source === "wallet"
        ? walletTransferRequest(env.chainId, symbol, amount, to)
        : withdrawRequest(env.chainId, symbol, amount, to, positionCount(snapshot?.positionBitmap ?? 0));
    const move: ExecutedMove = { amount, symbol, chainId: env.chainId, to, network: network.name, practice, source };
    await requestStepUp(
      {
        title: `Send ${usd(amount)} ${symbol}`,
        detail: `To ${recipient.handle ? `@${recipient.handle} · ` : ""}${to} on ${network.name}${practice ? " (practice money)" : ""}. Sends outside your account always ask for a fresh passkey check.`,
        confirmLabel: "Send with passkey",
      },
      () =>
        account.stepUp((signer) => {
          setExecuted(move);
          return trace.run(stepUpSender(signer), request, {
            preflight: gas.preflight(request),
            revalidate: async () => {
              guard();
              await validateMoney(env, me, source, symbol, amount);
              if (recipient.handle) {
                const current = await env.api.call(profileGetRoute, {
                  params: { handleOrAddress: recipient.handle },
                  query: { chainId: env.chainId },
                });
                if (current.address.toLowerCase() !== to.toLowerCase())
                  throw new Error("The recipient changed. Review again.");
              }
              guard();
            },
          });
        }),
    );
  };

  // Once it is out, the screen is its receipt until it settles: no second send can start beside an unresolved one.
  const receiptMove = executed ?? restoredMove(trace.record);
  if (receiptMove && (trace.running || trace.events.length > 0)) {
    return (
      <MoneyReceipt
        move={receiptMove}
        record={trace.record}
        events={trace.events}
        running={trace.running}
        words={SEND_WORDS}
        onAgain={(fresh) => {
          trace.reset();
          setExecuted(undefined);
          if (fresh) {
            draft.reset();
            setInput("");
          }
        }}
        onLeave={() => router.back()}
      />
    );
  }

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
      {input === "" && me ? <RecentRecipients address={me} onPick={setInput} /> : null}
      <Segmented options={TOKENS} value={symbol} onChange={setSymbol} label="Token" />
      <AmountEntry draft={draft} max={max} symbol={symbol} label="Amount to send" />
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
        <KeyValue label="From" value={source === "wallet" ? "Your wallet" : "Trading account"} />
      </Panel>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        {symbol}
        {practice ? " · test token" : ""}. The amount above is what the passkey check signs.
      </Text>
      <HoldToConfirm
        resetKey={[
          env.chainId,
          me,
          source,
          symbol,
          amount,
          input,
          recipient.status === "ready" ? recipient.address : "",
        ].join(":")}
        label={amount > 0n ? `Send ${usd(amount)}` : "Send"}
        disabled={!ready}
        onConfirm={() => void send()}
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
