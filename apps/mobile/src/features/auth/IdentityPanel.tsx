/**
 * Wallet & address (A10, B13; Receive grammar from Solflare S21 / Phantom): the account's avatar and @handle, the QR
 * of its address with Monad's mark in the middle, the address grouped in fours (tap for the short form), and Copy ·
 * Share circles — Share sends the canonical watch link with this network's chainId (F-D6). Under it the two networks
 * the same address lives on — Monad's mark, mode, chain id — each opening the explorer, and the passkey behind the
 * account. No account → the way in, never a blank.
 */
import { explorerAddressUrl, MAINNET, TESTNET } from "@senryo/config";
import { ids } from "@senryo/identity";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { ListRow } from "~/components/kit/ListRow";
import { QrCode } from "~/components/kit/QrCode";
import { Panel } from "~/components/kit/Surface";
import { Skeleton } from "~/components/kit/states";
import { Copy, ExternalLink, Share2 } from "~/components/kit/symbols";
import { ActionCircle } from "~/features/profile/ActionCircle";
import { QuietState } from "~/features/profile/QuietState";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { COPIED_MS } from "~/lib/constants/auth";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { shortAddress } from "~/lib/format";
import { useNetwork } from "~/lib/network";
import { watchLink } from "~/lib/share-link";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { accountName, useAccountIdentity } from "./SignInOutcome";

const QR_SIZE = 220;
const QR_MARK = 32;
const GROUP = 4;
const HEX_START = 2;
const NETWORKS = [TESTNET, MAINNET] as const;

/** "0x1a2b 3c4d …": the hex in groups of four, so it can be read back aloud. */
function grouped(address: string): string {
  const hex = address.slice(HEX_START);
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += GROUP) parts.push(hex.slice(i, i + GROUP));
  return `0x ${parts.join(" ")}`;
}

export function IdentityPanel() {
  const network = useNetwork();
  const { color } = useTheme();
  const account = useAccount();
  const address = account.hint?.address;
  const { handle, avatar } = useAccountIdentity(address);
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(true);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);

  if (!account.ready) {
    return (
      <View style={styles.hero} accessibilityRole="progressbar" accessibilityLabel="Loading your account">
        <Skeleton width="40%" />
        <Skeleton height={QR_SIZE} />
      </View>
    );
  }
  const hint = account.hint;
  if (!hint) {
    return (
      <QuietState
        line="No account on this phone"
        action={{
          label: "Create account",
          variant: "primary",
          onPress: () => router.push(accountRequiredRoute("add money")),
        }}
      />
    );
  }
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.who}>
          <Avatar avatar={avatar} address={hint.address} size={SIZE.avatarMd} />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{accountName(handle, hint.address)}</Text>
        </View>
        <QrCode
          value={hint.address}
          size={QR_SIZE}
          label={`Your address ${hint.address}`}
          center={<EntityMark id={ids.evmChain(network.chainId)} size={QR_MARK} decorative ground={color.paper} />}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Address ${hint.address}`}
          accessibilityHint={full ? "Shows the short form" : "Shows the whole address"}
          onPress={() => setFull((v) => !v)}
        >
          <Text selectable style={[TYPE.numSm, styles.center, { color: color.ink }]}>
            {full ? grouped(hint.address) : shortAddress(hint.address)}
          </Text>
        </Pressable>
        <View style={styles.actions}>
          <ActionCircle
            label={copied ? "Copied" : "Copy"}
            icon={Copy}
            onPress={() =>
              void Clipboard.setStringAsync(hint.address).then(() => {
                fire("confirm");
                setCopied(true);
              })
            }
          />
          <ActionCircle
            label="Share"
            icon={Share2}
            onPress={() => void Share.share({ message: watchLink(hint.address, network.chainId) })}
          />
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeading>Networks</SectionHeading>
        <Panel>
          {NETWORKS.map((n) => (
            <ListRow
              key={n.key}
              title={n.modeLabel}
              detail={`${n.name} · ${n.chainId}`}
              leading={<EntityMark id={ids.evmChain(n.chainId)} size={SIZE.markRow} decorative />}
              trailing={<ExternalLink size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />}
              onPress={() => void Linking.openURL(explorerAddressUrl(n.chainId, hint.address))}
            />
          ))}
        </Panel>
      </View>
      <Panel>
        <ListRow
          title={hint.mode === "vault" ? "Signed in with a backup passkey" : "Signed in with Passkey"}
          leading={<PasskeyGlyph color={color.ink} />}
        />
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: SPACE.lg },
  who: { alignItems: "center", gap: SPACE.sm },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: SPACE.xl },
  section: { gap: SPACE.md },
});
