/**
 * Deposit from a Monad wallet or an exchange (F21 "Monad" family, S8.24): the account's own deposit inbox
 * (`InboxFactory.inboxOf`, read from the chain), registered with the api so the keeper credits it. The user needs
 * no MON. The status reads the inbox itself: waiting → arrived (below the minimum, or crediting) → credited.
 * `compact` is the fan's Receive sheet (P21/FT057, Codex S1b.7 consult #8): mode + full network, the accepted assets,
 * the QR and address with Copy/Share, the warning and the status line; the full page keeps "How it works". Every
 * block is a borderless filled group.
 */

import { INBOX_SWEEP_MIN_USD6 } from "@senryo/config";
import { collateralId, ids } from "@senryo/identity";
import { useInbox, useInboxWatch } from "@senryo/query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { QR_CENTER_SHARE, QrCode } from "~/components/kit/QrCode";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { COPIED_MS } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { usd } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useInboxCredit } from "./useInboxCredit";

/** The full receive page's code (S21 fills most of the width); the compact sheet keeps the kit size. */
const RECEIVE_QR = 236;
/** The chain mark fills this much of the paper disc at the code's centre. */
const QR_MARK_FILL = 0.82;

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
  const credited = useInboxCredit(
    user,
    inbox,
    reading.status === "fresh" ? reading.value.waitingUsd6 : undefined,
    reading.status === "fresh" ? reading.value.blockNumber : undefined,
  );
  const [fullAddress, setFullAddress] = useState(false);
  const [help, setHelp] = useState(false);
  const practice = network.modeLabel === "Practice";
  return (
    <ReadingView reading={reading} loading="plate" loadingLabel="Reading your deposit address">
      {({ inbox: address, waitingUsd6 }) => (
        <View style={styles.stack}>
          <Panel style={styles.panel}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>Trading account</Text>
            <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
              {practice ? "Practice" : "Mainnet · Real money"} · {network.name} · AUSD or USDC
            </Text>
            <View style={styles.qr}>
              <QrCode
                value={address}
                label={`Deposit address ${address}`}
                size={compact ? SIZE.qr : RECEIVE_QR}
                center={
                  <EntityMark
                    id={ids.evmChain(network.chainId)}
                    size={(compact ? SIZE.qr : RECEIVE_QR) * QR_CENTER_SHARE * QR_MARK_FILL}
                    decorative
                    ground={color.paper}
                  />
                }
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show full trading deposit address"
              onPress={() => setFullAddress(!fullAddress)}
            >
              <Text
                selectable
                accessibilityLabel={`Deposit address ${address}`}
                style={[TYPE.numSm, { color: color.ink }]}
              >
                {fullAddress ? address : shortAddress(address)}
              </Text>
            </Pressable>
            <AddressActions address={address} />
            {compact ? (
              <>
                <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                  Trading deposits accept AUSD and USDC on {network.name} only.
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
              <Button
                label={help ? "Hide deposit details" : "Deposit details"}
                variant="ghost"
                onPress={() => setHelp(!help)}
              />
              {help ? (
                <Panel style={styles.panel}>
                  <MarkedLine id={collateralId(network.chainId, "AUSD")} label="AUSD on Monad" size={SIZE.markToken} />
                  <MarkedLine id={collateralId(network.chainId, "USDC")} label="USDC on Monad" size={SIZE.markToken} />
                  <KeyValue label="Minimum" value={usd(INBOX_SWEEP_MIN_USD6)} />
                  <KeyValue label="Credit" value="After a finalized sweep" />
                  <KeyValue label="Gas" value="None — Senryo credits it for you" />
                  <Text style={[TYPE.rowDetail, { color: color.warn }]}>
                    Trading deposits accept AUSD and USDC on {network.name} only.
                  </Text>
                </Panel>
              ) : null}
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
        style={{ flex: 1 }}
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
        style={{ flex: 1 }}
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
