/**
 * Deposit from a Monad wallet or an exchange (F21 "Monad" family, S8.24): the account's own deposit inbox
 * (`InboxFactory.inboxOf`, read from the chain), registered with the api so the keeper credits it. The user needs
 * no MON. The status reads the inbox itself: waiting → arrived (below the minimum, or crediting) → credited.
 * `compact` is the fan's Receive sheet (P21/FT057, Codex S1b.7 consult #8): mode + full network, the accepted assets,
 * the QR and address with Copy/Share, the warning and the status line; the full page keeps "How it works". Every
 * block is a borderless filled group.
 */

import { INBOX_SWEEP_MIN_USD6 } from "@senryo/config";
import { collateralId } from "@senryo/identity";
import { keys, useInbox, useInboxWatch } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { QrCode } from "~/components/kit/QrCode";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { COPIED_MS } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function MonadInbox({ compact = false }: { compact?: boolean }) {
  const account = useAccount();
  const readOnly = useReadOnlyNetwork();
  if (readOnly) {
    return (
      <EmptyState
        why="Deposits open at launch"
        detail="Your Mainnet deposit address appears here once Senryo is live on Monad. Practice works today."
      />
    );
  }
  if (!account.hint) {
    return (
      <EmptyState
        why="Your deposit address appears after sign-in"
        detail="Each account has its own address for AUSD and USDC on Monad."
        action={{ label: "Create or sign in", onPress: () => router.push(ROUTES.welcome) }}
      />
    );
  }
  return <InboxPanel user={account.hint.address} compact={compact} />;
}

function InboxPanel({ user, compact }: { user: `0x${string}`; compact: boolean }) {
  const network = useNetwork();
  const { color } = useTheme();
  const reading = useInbox(user);
  const inbox = reading.status === "fresh" || reading.status === "stale" ? reading.value.inbox : undefined;
  const watch = useInboxWatch(user, inbox);
  const credited = useCreditedAfterArrival(user, reading.status === "fresh" ? reading.value.waitingUsd6 : undefined);
  const practice = network.modeLabel === "Practice";
  return (
    <ReadingView reading={reading} loading="plate" loadingLabel="Reading your deposit address">
      {({ inbox: address, waitingUsd6 }) => (
        <View style={styles.stack}>
          <Panel style={styles.panel}>
            <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
              {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name} · AUSD or USDC
            </Text>
            <View style={styles.qr}>
              <QrCode value={address} label={`Deposit address ${address}`} />
            </View>
            <Text
              selectable
              accessibilityLabel={`Deposit address ${address}`}
              style={[TYPE.numSm, { color: color.ink }]}
            >
              {address}
            </Text>
            <AddressActions address={address} />
            {compact ? (
              <>
                <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                  Send only AUSD or USDC on the {network.name} network. Other tokens, or any other network, can't be
                  recovered from this address.
                </Text>
                <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{statusLine(waitingUsd6, credited)}</Text>
                {watch.isError ? (
                  <Button label="Try again" variant="outline" size="sm" onPress={() => void watch.refetch()} />
                ) : null}
              </>
            ) : null}
          </Panel>
          {compact ? null : (
            <>
              <Panel style={styles.panel}>
                <SectionLabel>Status</SectionLabel>
                <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{statusLine(waitingUsd6, credited)}</Text>
                {watch.isError ? (
                  <View style={styles.stack}>
                    <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                      Couldn't register this address with Senryo. A deposit sent now waits in it until this works.
                    </Text>
                    <Button label="Try again" variant="outline" size="sm" onPress={() => void watch.refetch()} />
                  </View>
                ) : watch.isPending ? (
                  <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Getting your address ready…</Text>
                ) : null}
              </Panel>
              <Panel style={styles.panel}>
                <SectionLabel>How it works</SectionLabel>
                <MarkedLine id={collateralId(network.chainId, "AUSD")} label="AUSD on Monad" size={SIZE.markToken} />
                <MarkedLine id={collateralId(network.chainId, "USDC")} label="USDC on Monad" size={SIZE.markToken} />
                <KeyValue label="Minimum" value={usd(INBOX_SWEEP_MIN_USD6)} />
                <KeyValue label="Arrives" value="About a minute after your transfer confirms" />
                <KeyValue label="Gas" value="None — Senryo credits it for you" />
                <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                  Send only AUSD or USDC on the {network.name} network. Other tokens, or any other network, can't be
                  recovered from this address.
                </Text>
              </Panel>
            </>
          )}
        </View>
      )}
    </ReadingView>
  );
}

function statusLine(waitingUsd6: bigint, credited: boolean): string {
  if (waitingUsd6 === 0n) return credited ? "Credited to your account ✓" : "Waiting for your deposit";
  if (waitingUsd6 < INBOX_SWEEP_MIN_USD6) {
    return `${usd(waitingUsd6)} arrived · send ${usd(INBOX_SWEEP_MIN_USD6 - waitingUsd6)} more to be credited`;
  }
  return `${usd(waitingUsd6)} arrived · crediting to your account`;
}

/** True once money seen in the inbox has left it (swept into the core); refreshes the account's balances then. */
function useCreditedAfterArrival(user: `0x${string}`, waitingUsd6: bigint | undefined): boolean {
  const network = useNetwork();
  const queryClient = useQueryClient();
  const seen = useRef(false);
  const [credited, setCredited] = useState(false);
  useEffect(() => {
    if (waitingUsd6 === undefined) return;
    if (waitingUsd6 >= INBOX_SWEEP_MIN_USD6) {
      seen.current = true;
      setCredited(false);
    } else if (waitingUsd6 === 0n && seen.current) {
      seen.current = false;
      setCredited(true);
      fire("filled", { sound: "deposit" });
      void queryClient.invalidateQueries({ queryKey: keys.account(network.chainId, user) });
    }
  }, [waitingUsd6, network.chainId, user, queryClient]);
  return credited;
}

function AddressActions({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <View style={styles.actions}>
      <Button
        label={copied ? "Copied" : "Copy address"}
        variant="outline"
        size="sm"
        block={false}
        onPress={() => {
          void Clipboard.setStringAsync(address).then(() => {
            fire("tick");
            setCopied(true);
          });
        }}
      />
      <Button
        label="Share"
        variant="outline"
        size="sm"
        block={false}
        onPress={() => void Share.share({ message: address })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  qr: { alignItems: "center", paddingVertical: SPACE.sm },
  actions: { flexDirection: "row", gap: SPACE.sm },
});
