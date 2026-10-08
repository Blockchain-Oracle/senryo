/**
 * Receive on Monad (B3; Solflare S21 grammar): ONE address — the wallet itself — receives every token, so there is no
 * wallet/trading toggle and no deposit inbox here (the inbox only sweeps AUSD/USDC and would strand anything else).
 * The network pill with the Monad mark, optional asset chips that only change the share text, the dotted QR with the
 * Monad badge, the address in grouped mono, Copy · Share · Explorer circles, one line, and the way to other chains.
 * Fresh complete holdings changes say Balance updated; only inbound transfer evidence can establish a receipt.
 */
import { explorerAddressUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import { type WalletSnapshot, walletSnapshot } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { ChipRow } from "~/components/kit/ChipRow";
import { ExternalLink, Share } from "~/components/kit/symbols";
import { ActionCircle, ActionCircles } from "~/features/money/ActionCircle";
import type { MoneyAsset } from "~/features/money/assets";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";
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
const CHIPS_MAX = 4;
const ANY = "any";

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

/** Complete, fresh holdings snapshots are balance evidence, not inbound-transfer evidence. */
function useArrival(scope: string, assets: readonly MoneyAsset[], ready: boolean): string | undefined {
  const baseline = useRef<WalletSnapshot | undefined>(undefined);
  const [moment, setMoment] = useState<string>();
  useEffect(() => {
    baseline.current = undefined;
    setMoment(undefined);
  }, [scope]);
  useEffect(() => {
    const result = walletSnapshot(baseline.current, scope, assets, ready);
    baseline.current = result.snapshot;
    if (result.changed) setMoment("Balance updated");
  }, [scope, assets, ready]);
  return moment;
}

export function ReceiveCard({
  address,
  preselected,
  exchange: _exchange,
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
  const scope = `${network.chainId}:${address.toLowerCase()}`;
  const chips = money.assets.filter((a, i) => i < CHIPS_MAX || a.key === preselected);
  const [chip, setChip] = useState<string>(preselected && chips.some((c) => c.key === preselected) ? preselected : ANY);
  const picked = chips.find((c) => c.key === chip);
  const actions = useAddressActions(
    scope,
    address,
    `${picked ? `${picked.symbol} on ` : ""}${network.name}\n${address}`,
  );
  useEffect(() => {
    setChip(preselected ?? ANY);
  }, [scope, preselected]);
  const moment = useArrival(
    scope,
    [...money.assets, ...money.other, ...money.hidden],
    money.status === "ready" && !money.stale && !money.partial && !money.degraded,
  );
  const [top, bottom] = groupedAddress(address);
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
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
        Send tokens on {network.name} to this wallet address. Check the sending network before you transfer.
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
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
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
});
