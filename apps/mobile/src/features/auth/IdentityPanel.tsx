/**
 * The account, shown large (F08 proof: create on the phone, sign in on the web → the identical address), with copy
 * and a read-only watch link to share (D-031). No account → the way in, never a blank.
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
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

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
        <Text style={[TYPE.label, { color: color.ink }]}>NO ACCOUNT ON THIS PHONE</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Create one with Face ID, or open the account you already have — the same passkey gives the same address on
          every device.
        </Text>
        <Button label="Create or sign in" onPress={() => router.push(ROUTES.welcome)} />
      </Panel>
    );
  }
  return (
    <Panel style={styles.panel}>
      <View style={styles.head}>
        <Text style={[TYPE.label, { color: color.inkMuted }]}>YOUR ACCOUNT</Text>
        <Text style={[TYPE.micro, styles.pill, { color: color.up, borderColor: color.up }]}>
          {network.modeLabel.toUpperCase()}
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
      <Text style={[TYPE.micro, { color: color.inkMuted }]}>
        {hint.mode === "vault" ? "BACKUP PASSKEY" : "PASSKEY"} ·{" "}
        {hint.credential.credentialId.slice(0, CREDENTIAL_SHOWN)}…
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.md, gap: SPACE.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs },
  actions: { flexDirection: "row", gap: SPACE.sm, flexWrap: "wrap" },
});
