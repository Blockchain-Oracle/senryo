import { authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { perplPracticeFundsRequest } from "@senryo/chain";
import { PERPL_COLLATERAL, TESTNET_CHAIN_ID } from "@senryo/config";
import { useQueryEnv, useSendTrace } from "@senryo/query";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { type TraceWords, TradeTrace } from "~/features/trade/TradeTrace";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender } from "~/lib/account/sender";
import { notify } from "~/lib/notify";
import { useReviewGuard } from "~/lib/review-guard";
import { SPACE, TYPE, useTheme } from "~/theme";

const WORDS: TraceWords = {
  thing: "test token request",
  again: "Request again",
  reverted: "The faucet request reverted",
  back: "Back",
  leave: "Close",
  pending: "Requesting test AUSD",
  success: "Test token request confirmed",
  landed: "The request is finalized. Your actual AUSD balance refreshes now.",
  done: "Done",
};
/** Dedicated native funding for Perpl's separate test collateral; actual faucet transaction, never a credit animation. */
export function PerplPracticeFunds({ open, onClose }: { open: boolean; onClose: () => void }) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const trace = useSendTrace(`perpl-faucet:${env.chainId}:${address ?? "guest"}`);
  const outcome = useSettledOutcome(trace.events);
  const { color } = useTheme();
  const [busy, setBusy] = useState(false);
  const guard = useReviewGuard(`${env.chainId}:${address}:perpl-faucet:${open}`);
  const request = async () => {
    if (env.chainId !== TESTNET_CHAIN_ID || !address || trace.running || busy) return;
    setBusy(true);
    try {
      await account.stepUp((signer) =>
        trace.run(stepUpSender(signer), perplPracticeFundsRequest(address), {
          reviewedIntent: {
            kind: "perpl-faucet",
            network: "testnet",
            recipient: address,
            token: PERPL_COLLATERAL[TESTNET_CHAIN_ID],
          },
          revalidate: async () => guard(),
        }),
      );
    } catch (error) {
      const kind = classifyAuthError(error);
      if (!isSilent(kind))
        notify({ title: authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android").title, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ChildSheet open={open} onClose={onClose} title="Perpl practice funds">
      <View style={styles.body}>
        {trace.events.length > 0 ? (
          <TradeTrace
            events={trace.events}
            record={trace.record}
            running={trace.running}
            outcome={outcome}
            words={WORDS}
            onLeave={onClose}
            onDone={() => {
              trace.reset();
              onClose();
            }}
          />
        ) : (
          <>
            <Text style={[TYPE.body, { color: color.text2 }]}>
              Perpl uses Agora test AUSD on Monad Testnet. These tokens have no cash value and are separate from your
              pair-trading practice balance.
            </Text>
            <DetailRow label="Network" value="Monad Testnet" />
            <DetailRow label="Recipient" value={address ?? "Sign in first"} />
            <Text style={[TYPE.meta, { color: color.text3 }]}>
              The faucet sets eligibility and delivery. A small amount of test MON pays the network fee. Your wallet
              confirms this request.
            </Text>
            <Button
              label="Request test AUSD"
              onPress={() => void request()}
              loading={busy}
              disabled={!address || env.chainId !== TESTNET_CHAIN_ID}
            />
          </>
        )}
      </View>
    </ChildSheet>
  );
}
const styles = StyleSheet.create({ body: { gap: SPACE.md } });
