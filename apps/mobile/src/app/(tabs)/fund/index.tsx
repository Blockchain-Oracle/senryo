import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { KeyValue, Panel, SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { fire } from "~/feedback/fire";
import { fundQrRoute, ROUTES } from "~/lib/constants/routes";
import { pct, usd } from "~/lib/money";
import { SAMPLE_QUOTE } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Deposit families (F21 / F17): each shows a persistent address + requirements once the account exists (S9). */
const FAMILIES = [
  { id: "monad", label: "Monad wallet", detail: "AUSD or USDC from any Monad wallet" },
  { id: "evm", label: "EVM chains", detail: "Base, Ethereum, Arbitrum… via intents" },
  { id: "solana", label: "Solana", detail: "USDC via intents" },
  { id: "btc", label: "Bitcoin", detail: "BTC via intents" },
] as const;

/** Fund (D2): bridge + deposit from any chain into AUSD, the swap preview, and QR families. */
export default function Fund() {
  const { color } = useTheme();
  const quote = useSample("quote", SAMPLE_QUOTE);
  return (
    <Screen>
      <PreviewBadge />
      <SectionLabel>BRIDGE + DEPOSIT · ANY CHAIN → AUSD</SectionLabel>
      <ReadingView reading={quote} loading="plate" loadingLabel="Fetching a quote">
        {(q) => (
          <Panel style={styles.swap}>
            <View style={styles.between}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
                {q.payToken} on {q.payChain} → {q.receiveToken} on {q.receiveChain}
              </Text>
            </View>
            <KeyValue label="RATE" value={`1 ${q.payToken} = 1 ${q.receiveToken}`} />
            <KeyValue label="NETWORK FEE" value={usd(q.networkFee6)} />
            <KeyValue label="SLIPPAGE" value={pct(q.slippageBps)} />
            <KeyValue label="ETA" value={`≈ ${q.etaSeconds}s`} />
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
        {FAMILIES.map((f, i) => (
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
  between: { flexDirection: "row", justifyContent: "space-between" },
  family: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, minHeight: SIZE.touch },
  flex: { flex: 1, gap: SPACE.xxs },
});
