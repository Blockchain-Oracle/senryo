/**
 * Practice ↔ Mainnet (S8.22, F06/F49; Living Lacquer §5.6): two explained rows with each network's balance. Practice
 * switches at once; Mainnet takes a deliberate "Switch to real money" — which also locks the session, so the next
 * signature starts fresh limits under mainnet's Face ID floor (D-037). Before the mainnet launch the row is open for
 * browsing live prices and says trading opens at launch.
 */
import { MAINNET, TESTNET } from "@senryo/config";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { usd } from "~/lib/money";
import { mainnetTradingLive, type NetworkKey, setActiveNetwork, useNetwork } from "~/lib/network";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { useNetworkBalances } from "./useNetworkBalances";

function Mark({ label, tone, wash }: { label: string; tone: string; wash: string }) {
  return (
    <Text style={[TYPE.micro, styles.mark, { color: tone, borderColor: tone, backgroundColor: wash }]}>{label}</Text>
  );
}

export function NetworkPicker({ onDone }: { onDone?: () => void }) {
  const { color } = useTheme();
  const network = useNetwork();
  const account = useAccount();
  const balances = useNetworkBalances();
  const [confirming, setConfirming] = useState(false);
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
      <Panel>
        <ListRow
          first
          title="Practice · Paper money"
          detail={`${TESTNET.name} · test dollars with no real value${
            balances.practice === undefined ? "" : ` · ${usd(balances.practice, undefined, TESTNET.key)}`
          }`}
          onPress={() => choose(TESTNET.key)}
          trailing={
            network.key === TESTNET.key ? (
              <Mark label="IN USE" tone={color.practice} wash={color.practiceWash} />
            ) : undefined
          }
        />
        <ListRow
          title="Mainnet · Real money"
          detail={
            live
              ? `${MAINNET.name} · your real funds${
                  balances.mainnet === undefined ? "" : ` · ${usd(balances.mainnet, undefined, MAINNET.key)}`
                }`
              : `${MAINNET.name} · live prices to browse · trading opens at launch`
          }
          onPress={() => choose(MAINNET.key)}
          trailing={
            network.key === MAINNET.key ? (
              <Mark label="IN USE" tone={color.mainnet} wash={color.mainnetWash} />
            ) : undefined
          }
        />
      </Panel>
      {confirming ? (
        <View style={[styles.confirm, { borderColor: color.mainnet, backgroundColor: color.mainnetWash }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Switch to real money?</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {live
              ? "Trades and card spends use your real funds on Monad. Face ID confirms anything above your limit; your session locks now and starts fresh."
              : "Mainnet isn't open for trading yet — you can browse live prices. Your practice positions stay where they are."}
          </Text>
          <Button label="Switch to real money" onPress={switchToReal} />
          <Button label="Stay in practice" variant="outline" onPress={() => setConfirming(false)} />
        </View>
      ) : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        One passkey, one address on both networks — balances and positions stay separate.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  mark: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs },
  confirm: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.sm },
});
