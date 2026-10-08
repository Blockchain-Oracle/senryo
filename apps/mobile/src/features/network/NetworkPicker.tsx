/**
 * The mode sheet's two rows (A8, Part A rule 9; Fomo F21/F22 selection): Monad's mark, the mode, its balance, and a
 * check on the one in use. Practice switches at once. Real opens one sentence and a slide — "Slide to use real money"
 * — and only the completed slide switches; it also locks the session so the next signature starts under Real's Face ID
 * floor (D-037). Partial totals carry "≈". A deep link for Real (`request`) opens on the slide.
 */
import { MAINNET, TESTNET } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { Check } from "~/components/kit/symbols";
import { SheetRow } from "~/components/sheet/SheetRow";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { useAccount } from "~/lib/account/provider";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { usd } from "~/lib/money";
import { type NetworkKey, setActiveNetwork, useNetwork } from "~/lib/network";
import { SHEET_SHAPE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { useNetworkBalances } from "./useNetworkBalances";

function amount(value: bigint | undefined, partial: boolean, key: NetworkKey): string | undefined {
  if (value === undefined) return undefined;
  return `${partial ? "≈ " : ""}${usd(value, undefined, key)}`;
}

export function NetworkPicker({ onDone, request }: { onDone?: () => void; request?: NetworkKey | undefined }) {
  const { color } = useTheme();
  const network = useNetwork();
  const account = useAccount();
  const balances = useNetworkBalances();
  const [confirming, setConfirming] = useState(
    !DEV_WORKSPACE && request === MAINNET.key && network.key !== MAINNET.key,
  );

  const choose = (key: NetworkKey) => {
    if (key === network.key) return onDone?.();
    if (key === MAINNET.key) return setConfirming((v) => !v);
    setConfirming(false);
    setActiveNetwork(TESTNET.key);
    onDone?.();
  };
  const switchToReal = () => {
    account.lock();
    setActiveNetwork(MAINNET.key);
    setConfirming(false);
    onDone?.();
  };
  const practice = amount(balances.practice, balances.practicePartial, TESTNET.key);
  const mainnet = amount(balances.mainnet, balances.mainnetPartial, MAINNET.key);
  const check = (key: NetworkKey) =>
    network.key === key ? (
      <Check
        size={SIZE.icon}
        strokeWidth={SIZE.iconStroke}
        color={key === MAINNET.key ? color.mainnet : color.practice}
      />
    ) : undefined;

  return (
    <View style={styles.wrap}>
      <SheetRow
        index={0}
        leading={<EntityMark id={ids.evmChain(TESTNET.chainId)} size={SIZE.markToken} decorative />}
        title={TESTNET.modeLabel}
        {...(practice ? { detail: practice } : {})}
        selected={network.key === TESTNET.key}
        onPress={() => choose(TESTNET.key)}
        trailing={check(TESTNET.key)}
      />
      <SheetRow
        index={1}
        leading={<EntityMark id={ids.evmChain(MAINNET.chainId)} size={SIZE.markToken} decorative />}
        title={MAINNET.modeLabel}
        {...(DEV_WORKSPACE
          ? { detail: "Unavailable in the local development workspace" }
          : mainnet
            ? { detail: mainnet }
            : {})}
        disabled={DEV_WORKSPACE}
        selected={network.key === MAINNET.key}
        onPress={() => choose(MAINNET.key)}
        trailing={check(MAINNET.key)}
      />
      {confirming ? (
        <Animated.View entering={FadeIn.duration(TIMING.selection)} style={styles.confirm}>
          <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>Real money from here.</Text>
          <SlideToConfirm label="Slide to use real money" onConfirm={switchToReal} resetKey={network.key} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SHEET_SHAPE.rowGap },
  confirm: { gap: SPACE.md, paddingTop: SPACE.xs },
  center: { textAlign: "center" },
});
