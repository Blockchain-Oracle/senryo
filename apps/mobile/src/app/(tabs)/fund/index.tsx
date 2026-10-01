import { ids, ROUTE_CHAIN_ID } from "@senryo/identity";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MarkCluster } from "~/components/identity/MarkCluster";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { RouteAsset } from "~/components/identity/RouteAsset";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SAMPLE_QUOTE } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Deposit families (F21 / F17): each shows a persistent address + requirements once the account exists (S9). Each
 * row carries the real network marks it accepts from.
 */
const familiesOn = (chainId: number) => [
  {
    id: "monad",
    label: "Monad wallet",
    detail: "AUSD or USDC from any Monad wallet",
    marks: [ids.evmChain(chainId)],
  },
  {
    id: "evm",
    label: "EVM chains",
    detail: "Base, Ethereum, Arbitrum… via intents",
    marks: [ROUTE_CHAIN_ID.base, ROUTE_CHAIN_ID.ethereum, ROUTE_CHAIN_ID.arbitrum],
  },
  { id: "solana", label: "Solana", detail: "USDC via intents", marks: [ROUTE_CHAIN_ID.solana] },
  { id: "btc", label: "Bitcoin", detail: "BTC via intents", marks: [ROUTE_CHAIN_ID.bitcoin] },
];

/** Fund (D2): bridge + deposit from any chain into AUSD, the swap preview, and QR families. */
export default function Fund() {
  const network = useNetwork();
  const { color } = useTheme();
  const quote = useSample("quote", SAMPLE_QUOTE);
  return (
    <Screen>
      <PreviewBadge />
      <SectionLabel>BRIDGE + DEPOSIT · ANY CHAIN → AUSD</SectionLabel>
      <ReadingView reading={quote} loading="plate" loadingLabel="Fetching a quote">
        {(q) => (
          <Panel style={styles.swap}>
            <View style={styles.route}>
              <RouteAsset symbol={q.payToken} chain={q.payChain} />
              <Icon name="chevron" size={SIZE.iconSm} tint={color.inkMuted} />
              <RouteAsset symbol={q.receiveToken} chain={q.receiveChain} />
            </View>
            <KeyValue label="RATE" value={`1 ${q.payToken} = 1 ${q.receiveToken}`} />
            <KeyValue label="NETWORK FEE" value={usd(q.networkFee6)} />
            <KeyValue label="SLIPPAGE" value={pct(q.slippageBps)} />
            <KeyValue label="ETA" value={`≈ ${q.etaSeconds}s`} />
            <MarkedLine id={ids.provider("aurora")} label="Powered by Aurora Intents" />
            <Button
              label={`Swap to ${q.receiveToken}`}
              onPress={() => router.push(ROUTES.fundSwap)}
              variant="secondary"
            />
          </Panel>
        )}
      </ReadingView>
      <SectionLabel>OR SEND DIRECTLY</SectionLabel>
      <Panel>
        {familiesOn(network.chainId).map((f, i) => (
          <Pressable
            key={f.id}
            onPress={() => {
              fire("tick");
              router.push(fundQrRoute(f.id));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${f.label}. ${f.detail}`}
            style={[styles.family, i > 0 ? { borderTopWidth: HAIRLINE_PX, borderTopColor: color.hairline } : null]}
          >
            <MarkCluster ids={f.marks} size={SIZE.markCell} />
            <View style={styles.flex}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{f.label}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{f.detail}</Text>
            </View>
            <Icon name="chevron" size={SIZE.iconSm} tint={color.inkMuted} />
          </Pressable>
        ))}
      </Panel>
      <EmptyState
        why="Your deposit address appears after sign-in"
        detail="Each account gets its own persistent address; we never show a placeholder you could send funds to."
        action={{ label: "Add money options", onPress: () => router.push(ROUTES.addMoney) }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  swap: { padding: SPACE.md, gap: SPACE.sm },
  route: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  family: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, minHeight: SIZE.touch },
  flex: { flex: 1, gap: SPACE.xxs },
});
