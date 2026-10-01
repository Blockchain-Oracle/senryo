/**
 * The account, shown large (F08 proof: create on the phone, sign in on the web → the identical address), with copy
 * and a read-only watch link to share (D-031). No account → the way in, never a blank. The mode is a small filled
 * badge in its own colour (practice violet, mainnet blue), not an outlined pill.
 */
import { WEB_ORIGIN } from "@senryo/config";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { COPIED_MS } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const CREDENTIAL_SHOWN = 10;
const watchUrl = (address: string) => `${WEB_ORIGIN}/watch/?address=${address}`;

export function IdentityPanel() {
  const network = useNetwork();
  const { color } = useTheme();
  const account = useAccount();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);

  if (!account.ready) {
    return (
      <Panel style={styles.panel}>
        <Skeleton width="40%" />
        <Skeleton />
      </Panel>
    );
  }
  const hint = account.hint;
  if (!hint) {
    return (
      <Panel style={styles.panel}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>No account on this phone</Text>
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
          Create one with Face ID, or open the account you already have — the same passkey gives the same address on
          every device.
        </Text>
        <Button label="Create or sign in" onPress={() => router.push(ROUTES.welcome)} />
      </Panel>
    );
  }
  const practice = network.key === "testnet";
  return (
    <Panel style={styles.panel}>
      <View style={styles.head}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Your account</Text>
        <Text
          style={[
            TYPE.chipLabel,
            styles.badge,
            practice
              ? { color: color.practice, backgroundColor: color.practiceWash }
              : { color: color.mainnet, backgroundColor: color.mainnetWash },
          ]}
        >
          {network.modeLabel}
        </Text>
      </View>
      <Text
        selectable
        accessibilityLabel={`Account address ${hint.address}`}
        style={[TYPE.numSm, { color: color.ink }]}
      >
        {hint.address}
      </Text>
      <View style={styles.actions}>
        <Button
          label={copied ? "Copied" : "Copy address"}
          variant="outline"
          size="sm"
          block={false}
          onPress={() => {
            void Clipboard.setStringAsync(hint.address).then(() => {
              fire("tick");
              setCopied(true);
            });
          }}
        />
        <Button
          label="Share watch link"
          variant="ghost"
          size="sm"
          block={false}
          onPress={() => void Share.share({ message: watchUrl(hint.address) })}
        />
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        {hint.mode === "vault" ? "Backup passkey" : "Passkey"} ·{" "}
        {hint.credential.credentialId.slice(0, CREDENTIAL_SHOWN)}…
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
  actions: { flexDirection: "row", gap: SPACE.sm, flexWrap: "wrap" },
});
