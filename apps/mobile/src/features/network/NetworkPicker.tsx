/**
 * Practice ↔ Mainnet (S8.22, F06/F49; Living Lacquer §5.6): two explained rows with each network's balance. Practice
 * switches at once; Mainnet takes a deliberate "Switch to real money" — which also locks the session, so the next
 * signature starts fresh limits under mainnet's Face ID floor (D-037). Before the mainnet launch the row is open for
 * browsing live prices and says trading opens at launch. A deep link for the other network passes `request`: a
 * Mainnet request opens straight on the confirmation, which still takes the deliberate tap.
 */
import { MAINNET, TESTNET } from "@senryo/config";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { SheetRow } from "~/components/sheet/SheetRow";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { usd } from "~/lib/money";
import { mainnetTradingLive, type NetworkKey, setActiveNetwork, useNetwork } from "~/lib/network";
import { RADIUS, SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useNetworkBalances } from "./useNetworkBalances";

/** The mode's colour as a dot at the row's leading edge: violet for paper money, blue for real money (D-172). */
function ModeDot({ tone }: { tone: string }) {
  return <View style={[styles.dot, { backgroundColor: tone }]} />;
}

/** The current choice: a check in the mode's colour (Fomo F21/F22 mark selection at the trailing edge). */
function InUse({ tone }: { tone: string }) {
  return <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={tone} />;
}

export function NetworkPicker({ onDone, request }: { onDone?: () => void; request?: NetworkKey | undefined }) {
  const { color } = useTheme();
  const network = useNetwork();
  const account = useAccount();
  const balances = useNetworkBalances();
  const [confirming, setConfirming] = useState(request === MAINNET.key && network.key !== MAINNET.key);
  const live = mainnetTradingLive();

  const choose = (key: NetworkKey) => {
    fire("tick");
    if (key === network.key) return onDone?.();
    if (key === MAINNET.key) return setConfirming(true);
    setActiveNetwork(TESTNET.key);
    onDone?.();
  };
  const switchToReal = () => {
    fire("confirm");
    account.lock();
    setActiveNetwork(MAINNET.key);
    setConfirming(false);
    onDone?.();
  };

  return (
    <View style={styles.wrap}>
      <SheetRow
        index={0}
        leading={<ModeDot tone={color.practice} />}
        title="Practice"
        detail={`Paper money · ${TESTNET.name}${
          balances.practice === undefined ? "" : ` · ${usd(balances.practice, undefined, TESTNET.key)}`
        }`}
        selected={network.key === TESTNET.key}
        onPress={() => choose(TESTNET.key)}
        trailing={network.key === TESTNET.key ? <InUse tone={color.practice} /> : undefined}
      />
      <SheetRow
        index={1}
        leading={<ModeDot tone={color.mainnet} />}
        title="Mainnet"
        detail={
          live
            ? `Real money · ${MAINNET.name}${
                balances.mainnet === undefined ? "" : ` · ${usd(balances.mainnet, undefined, MAINNET.key)}`
              }`
            : `Real money · ${MAINNET.name} · trading opens at launch`
        }
        selected={network.key === MAINNET.key}
        onPress={() => choose(MAINNET.key)}
        trailing={network.key === MAINNET.key ? <InUse tone={color.mainnet} /> : undefined}
      />
      {confirming ? (
        <View style={[styles.confirm, { backgroundColor: color.mainnetWash }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Switch to real money?</Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            {live
              ? "Trades and card spends use your real funds on Monad. Face ID confirms anything above your limit; your session locks now and starts fresh."
              : "Mainnet isn't open for trading yet — you can browse live prices. Your practice positions stay where they are."}
          </Text>
          <Button label="Switch to real money" onPress={switchToReal} />
          <Button label="Stay in practice" variant="ghost" size="sm" onPress={() => setConfirming(false)} />
        </View>
      ) : null}
      <Text style={[TYPE.rowDetail, styles.center, { color: color.text3 }]}>
        One passkey, one address on both networks. Balances and positions stay separate.
      </Text>
    </View>
  );
}

const DOT = SPACE.md;

const styles = StyleSheet.create({
  wrap: { gap: SHEET_SHAPE.rowGap },
  dot: { width: DOT, height: DOT, borderRadius: RADIUS.pill },
  confirm: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.lg, gap: SPACE.md },
  center: { textAlign: "center" },
});
