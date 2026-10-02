/**
 * Receive on Monad (B3; Solflare S21 grammar): ONE address — the wallet itself — receives every token, so there is no
 * wallet/trading toggle and no deposit inbox here (the inbox only sweeps AUSD/USDC and would strand anything else).
 * The network pill with the Monad mark, optional asset chips that only change the share text, the dotted QR with the
 * Monad badge, the address in grouped mono, Copy · Share · Explorer circles, one line, and the way to other chains.
 * While it is open, a holdings increase of a verified token is the arrival moment ("Received 20 USDC", sound).
 */
import { explorerAddressUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Linking, Share as ShareSheet, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { ChipRow } from "~/components/kit/ChipRow";
import { Copy, ExternalLink, Share } from "~/components/kit/symbols";
import { ActionCircle, ActionCircles } from "~/features/money/ActionCircle";
import type { MoneyAsset } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
import { fire } from "~/feedback/fire";
import { COPIED_MS } from "~/lib/constants/auth";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, NUMERIC_VARIANT, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DottedQr } from "./DottedQr";

const QR_SIZE = 216;
const BADGE = 34;
const GROUP = 4;
const HEX_START = 2;
const GROUPS_PER_ROW = 5;
const CHIPS_MAX = 4;
const ANY = "any";

/** "0x1234 5678 9abc def0 1234" / "5678 9abc def0 1234 5678": ten groups of four on two rows. */
export function groupedAddress(address: string): [string, string] {
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

/** Watches the verified wallet balances while Receive is open; returns the first increase as the arrival moment. */
function useArrival(assets: readonly MoneyAsset[], ready: boolean): string | undefined {
  const baseline = useRef<Map<string, bigint> | undefined>(undefined);
  const [moment, setMoment] = useState<string>();
  useEffect(() => {
    if (!ready) return;
    if (!baseline.current) {
      baseline.current = new Map(assets.map((a) => [a.key, a.wallet]));
      return;
    }
    for (const a of assets) {
      const before = baseline.current.get(a.key) ?? 0n;
      if (a.wallet > before) {
        baseline.current.set(a.key, a.wallet);
        fire("filled", { sound: "deposit" });
        setMoment(`Received ${amountOf(a, a.wallet - before)}`);
        return;
      }
    }
  }, [assets, ready]);
  return moment;
}

export function ReceiveCard({
  address,
  preselected,
  exchange,
  onOtherChain,
}: {
  address: `0x${string}`;
  /** Lower-case token address from `?asset=`. */
  preselected?: string | undefined;
  /** Opened from "From an exchange": the network tip leads. */
  exchange?: boolean;
  onOtherChain: () => void;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const money = useMoneyAssets();
  const [copied, setCopied] = useState(false);
  const chips = money.assets.filter((a, i) => i < CHIPS_MAX || a.key === preselected);
  const [chip, setChip] = useState<string>(preselected && chips.some((c) => c.key === preselected) ? preselected : ANY);
  const picked = chips.find((c) => c.key === chip);
  const moment = useArrival(money.assets, money.status === "ready");
  const [top, bottom] = groupedAddress(address);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <View style={styles.stack}>
      {chips.length > 1 ? (
        <View style={styles.chips}>
          <ChipRow
            options={[{ value: ANY, label: "Any token" }, ...chips.map((c) => ({ value: c.key, label: c.symbol }))]}
            value={chip}
            onChange={setChip}
            label="Asset to receive"
          />
        </View>
      ) : null}
      {exchange ? (
        <View style={[styles.tip, { backgroundColor: color.raised2 }]}>
          <MarkCluster
            ids={[ids.exchange("coinbase"), ids.exchange("binance")]}
            size={SIZE.markCell}
            ground={color.raised2}
          />
          <View style={styles.tipText}>
            <Text style={[TYPE.rowStrong, { color: color.ink }]}>Choose Monad network</Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>Coinbase sends USDC on Monad</Text>
          </View>
        </View>
      ) : null}
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
      <ActionCircles>
        <ActionCircle
          icon={Copy}
          label={copied ? "Copied" : "Copy"}
          onPress={() => {
            void Clipboard.setStringAsync(address).then(() => {
              fire("filled");
              setCopied(true);
            });
          }}
        />
        <ActionCircle
          icon={Share}
          label="Share"
          onPress={() =>
            void ShareSheet.share({
              message: `${picked ? `${picked.symbol} on ` : ""}${network.name}\n${address}`,
            })
          }
        />
        <ActionCircle
          icon={ExternalLink}
          label="Explorer"
          onPress={() => void Linking.openURL(explorerAddressUrl(network.chainId, address))}
        />
      </ActionCircles>
      {moment ? (
        <Animated.Text
          entering={FadeIn}
          accessibilityLiveRegion="polite"
          style={[TYPE.rowStrong, styles.center, { color: color.up }]}
        >
          {moment}
        </Animated.Text>
      ) : (
        <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
          {picked ? `${picked.symbol} or any token on ${network.name}` : `Any token on ${network.name}`}
        </Text>
      )}
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
  chips: { marginHorizontal: -SPACE.lg },
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
  tip: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md },
  tipText: { flex: 1, gap: SPACE.xxs },
});
