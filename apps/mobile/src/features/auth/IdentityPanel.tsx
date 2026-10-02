/**
 * Account identity (J9; direction's "Account identity / addresses" row): the address, shown large and selectable
 * (F08 proof: create on the phone, sign in on the web → the identical address), with Copy as the page's one primary
 * action and a read-only watch link to share (D-031). Under it, the two networks the same address lives on — each
 * with Monad's own mark, its chain id and its explorer — and the passkey behind the account. This was the You tab's
 * hero; the person is now (F16), and the address has its own page. No account → the way in, never a blank.
 */
import { explorerAddressUrl, MAINNET, TESTNET, WEB_ORIGIN } from "@senryo/config";
import { ids } from "@senryo/identity";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Share, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { ExternalLink } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { COPIED_MS } from "~/lib/constants/auth";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CREDENTIAL_SHOWN = 10;
const watchUrl = (address: string) => `${WEB_ORIGIN}/watch/?address=${address}`;
const NETWORKS = [
  { network: TESTNET, money: "Paper money" },
  { network: MAINNET, money: "Real money" },
] as const;

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
      <View style={styles.hero} accessibilityRole="progressbar" accessibilityLabel="Loading your account">
        <Skeleton width="40%" />
        <Skeleton height={SIZE.skeletonRow} />
      </View>
    );
  }
  const hint = account.hint;
  if (!hint) {
    return (
      <View style={styles.hero}>
        <Text style={[TYPE.sectionTitle, { color: color.ink }]}>No account on this phone</Text>
        <Text style={[TYPE.body, { color: color.text2 }]}>
          Create one with a passkey, or open the account you already have. The same passkey gives the same address on
          every device.
        </Text>
        <Button label="Create or sign in" onPress={() => router.push(ROUTES.welcome)} />
      </View>
    );
  }
  const practice = network.key === "testnet";
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.head}>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Your address</Text>
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
          style={[TYPE.numMd, { color: color.ink }]}
        >
          {hint.address}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          One address in Practice and on Mainnet. Anyone who has it can watch this account; nobody can move money with
          it.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={copied ? "Copied" : "Copy address"}
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
          accessibilityHint="Shares a read-only link to this account"
          onPress={() => void Share.share({ message: watchUrl(hint.address) })}
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
          Networks
        </Text>
        <Panel>
          {NETWORKS.map(({ network: n, money }) => (
            <ListRow
              key={n.key}
              title={`${n.modeLabel} · ${n.name}`}
              detail={`${money} · chain ${n.chainId}`}
              leading={<EntityMark id={ids.evmChain(n.chainId)} size={SIZE.markRow} decorative />}
              trailing={<ExternalLink size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />}
              onPress={() => void Linking.openURL(explorerAddressUrl(n.chainId, hint.address))}
            />
          ))}
        </Panel>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          Each row opens this address in that network’s explorer.
        </Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
          Signed in with
        </Text>
        <Panel>
          <ListRow
            title={hint.mode === "vault" ? "Backup passkey" : "Passkey"}
            detail={`Credential ${hint.credential.credentialId.slice(0, CREDENTIAL_SHOWN)}…`}
            leading={<PasskeyGlyph color={color.ink} />}
          />
        </Panel>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACE.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
  actions: { gap: SPACE.xs },
  section: { gap: SPACE.md },
});
