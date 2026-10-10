/**
 * Receive on Monad (B3; Solflare S21 grammar): ONE address — the wallet itself — receives dollars (USDC on Real,
 * Test USD on Practice). The network pill with the Monad mark, the dotted QR with the Monad badge, the address in
 * grouped mono, Copy · Share · Explorer, and the way in from other chains (Aurora, S9).
 */
import { explorerAddressUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { ActionCircle, ActionCircles } from "~/components/kit/ActionCircle";
import { Button } from "~/components/kit/Button";
import { ExternalLink, Share } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, NUMERIC_VARIANT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useAddressActions } from "./address-actions";
import { DottedQr } from "./DottedQr";

const QR_SIZE = 196;
const BADGE = 34;
const GROUP = 4;
const HEX_START = 2;
const GROUPS_PER_ROW = 5;

/** "0x1234 5678 9abc def0 1234" / "5678 9abc def0 1234 5678": ten groups of four on two rows. */
export function groupedAddress(address: string): [string, string] {
  if (!/^0x[0-9a-f]+$/i.test(address)) {
    const middle = Math.ceil(address.length / 2);
    return [address.slice(0, middle), address.slice(middle)];
  }
  const body = address.slice(HEX_START);
  const groups = body.match(new RegExp(`.{1,${GROUP}}`, "g")) ?? [];
  return [`0x${groups.slice(0, GROUPS_PER_ROW).join(" ")}`, groups.slice(GROUPS_PER_ROW).join(" ")];
}

/** The network pill (ported from 21st.dev haydenbleasel/pill #1600): the chain's mark and its name on a raised plate. */
export function NetworkPill() {
  const { color } = useTheme();
  const network = useNetwork();
  return (
    <View
      style={[styles.pill, { backgroundColor: color.raised2 }]}
      accessible
      accessibilityLabel={`Network ${network.name}`}
    >
      <EntityMark id={ids.evmChain(network.chainId)} size={SIZE.markInline} decorative />
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.modeLabel, { color: color.ink }]}>
        {network.name}
      </Text>
    </View>
  );
}

export function ReceiveCard({ address, onOtherChain }: { address: `0x${string}`; onOtherChain: () => void }) {
  const { color } = useTheme();
  const network = useNetwork();
  const scope = `${network.chainId}:${address.toLowerCase()}`;
  const actions = useAddressActions(scope, address, `${network.name}\n${address}`);
  const [top, bottom] = groupedAddress(address);
  return (
    <View style={styles.stack}>
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
        Send dollars on {network.name} to this address. Check the sending network before you transfer.
      </Text>
      <View style={styles.code}>
        <DottedQr
          value={address}
          size={QR_SIZE}
          label={`Your ${network.name} address ${address}`}
          center={<EntityMark id={ids.evmChain(network.chainId)} size={BADGE} decorative ground={color.paper} />}
        />
      </View>
      <View accessible accessibilityLabel={`Address ${address}`}>
        <Text selectable style={[TYPE.numSm, styles.mono, { color: color.ink }]}>
          {top}
        </Text>
        <Text selectable style={[TYPE.numSm, styles.mono, { color: color.ink }]}>
          {bottom}
        </Text>
      </View>
      <Button label={actions.copied ? "Copied" : "Copy wallet address"} onPress={actions.copy} />
      {actions.error ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.destructive }]}>
          {actions.error}
        </Text>
      ) : null}
      <ActionCircles>
        <ActionCircle icon={Share} label="Share" onPress={actions.share} />
        <ActionCircle
          icon={ExternalLink}
          label="Explorer"
          onPress={() => actions.explorer(explorerAddressUrl(network.chainId, address))}
        />
      </ActionCircles>
      <Text
        onPress={() => {
          fire("tick");
          onOtherChain();
        }}
        accessibilityRole="link"
        suppressHighlighting
        style={[TYPE.rowStrong, styles.center, { color: color.link }]}
      >
        Sending from another chain? ›
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.lg },
  code: { alignItems: "center" },
  mono: { textAlign: "center", fontVariant: NUMERIC_VARIANT, letterSpacing: SPACE.xxs / 2 },
  center: { textAlign: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: SPACE.xs,
    paddingLeft: SPACE.xs,
    paddingRight: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
  },
});
