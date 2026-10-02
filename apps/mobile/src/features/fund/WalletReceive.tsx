import { collateralId, ids } from "@senryo/identity";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { QrCode } from "~/components/kit/QrCode";
import { Segmented } from "~/components/kit/Segmented";
import { useAccount } from "~/lib/account/provider";
import { shortAddress } from "~/lib/format";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const QR_SIZE = 236;
const ASSETS = [
  { value: "AUSD", label: "AUSD" },
  { value: "USDC", label: "USDC" },
  { value: "MON", label: "MON" },
] as const;
export function WalletReceive() {
  const network = useNetwork();
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const [asset, setAsset] = useState<"AUSD" | "USDC" | "MON">("AUSD");
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!address) return <Text style={[TYPE.body, { color: color.text3 }]}>Sign in to get your wallet address.</Text>;
  return (
    <View style={styles.stack}>
      <Segmented options={ASSETS} value={asset} onChange={setAsset} label="Receive asset" />
      <MarkedLine
        id={asset === "MON" ? ids.native(network.chainId, "MON") : collateralId(network.chainId, asset)}
        label={`${asset} · ${network.name}`}
      />
      <View style={styles.code}>
        <QrCode
          value={address}
          size={QR_SIZE}
          label={`Your wallet address ${address}`}
          center={<EntityMark id={ids.evmChain(network.chainId)} size={32} decorative ground={color.paper} />}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Wallet address ${address}. Show full address.`}
        onPress={() => setFull(!full)}
      >
        <Text selectable style={[TYPE.numSm, styles.center, { color: color.ink }]}>
          {full ? address : shortAddress(address)}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <Button
          label={copied ? "Copied" : "Copy"}
          style={styles.flex}
          onPress={() => {
            void Clipboard.setStringAsync(address).then(() => setCopied(true));
          }}
        />
        <Button
          label="Share"
          variant="outline"
          style={styles.flex}
          onPress={() => void Share.share({ message: `${asset} on ${network.name}\n${address}` })}
        />
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Receive on {network.name} only. Funds arrive in your wallet; moving them into trading is a separate transfer.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  code: { alignItems: "center", paddingVertical: SPACE.sm },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
});
