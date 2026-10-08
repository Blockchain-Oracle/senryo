/** Owned U11 workspace. The dark ticket is deliberately separate from the light financial review. */
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Delete } from "~/components/kit/symbols";
import type { KeypadKey } from "~/components/trade/Keypad";
import { AssetMark } from "~/features/money/AssetMark";
import type { AmountInput } from "~/features/money/amount";
import { type MoneyAsset, spendableOf } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";
import { splitSource } from "~/features/money/requests";
import { fire } from "~/feedback/fire";
import { usd } from "~/lib/money";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { DARK } from "~/theme/palette";

const KEYS: readonly KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
export function SendWorkspace({
  asset,
  input,
  recipient,
  network,
  warnings,
  block,
  onAsset,
  onRecipient,
  onReview,
  onTrades,
}: {
  asset: MoneyAsset;
  input: AmountInput;
  recipient?: string | undefined;
  network: string;
  warnings: readonly string[];
  block?: string | undefined;
  onAsset: () => void;
  onRecipient: () => void;
  onReview: () => void;
  onTrades: () => void;
}) {
  const { color } = useTheme();
  const source = splitSource(asset, input.amount);
  const available = spendableOf(asset);
  const reason =
    block ?? (input.amount === 0n ? "Enter an amount" : input.over ? `Not enough ${asset.symbol}` : undefined);
  return (
    <View style={styles.fill}>
      <Image
        source={require("../../../assets/money/send-texture.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessible={false}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[TYPE.displayBalance, styles.heading, { color: color.paperInk }]}>
          SEND
        </Text>
        <View style={[styles.ticket, { backgroundColor: DARK.ground }]}>
          <Pressable
            onPress={input.toggleMode}
            accessibilityRole="button"
            accessibilityLabel="Switch amount units"
            disabled={input.usd6 === null}
          >
            <Text style={[TYPE.displayBalance, styles.center, { color: DARK.ink }]}>
              {input.mode === "usd" ? "$" : ""}
              {input.text || "0"}
            </Text>
            <Text style={[TYPE.rowDetail, styles.center, { color: DARK.text2 }]}>
              {input.mode === "usd"
                ? amountOf(asset, input.amount)
                : input.usd6 !== null
                  ? usd(input.usd6)
                  : asset.symbol}
            </Text>
          </Pressable>
          <Pressable
            onPress={onAsset}
            accessibilityRole="button"
            accessibilityLabel="Choose source asset"
            style={[styles.chip, { backgroundColor: DARK.raised2 }]}
          >
            <AssetMark asset={asset} size={SIZE.markInline} />
            <Text style={[TYPE.rowStrong, { color: DARK.ink }]}>{asset.symbol} ⌄</Text>
          </Pressable>
          <Text style={[TYPE.meta, styles.center, { color: DARK.text2 }]}>
            {network} · Available {amountOf(asset, available)}
          </Text>
          <Pressable onPress={input.fillMax} accessibilityRole="button" style={styles.max}>
            <Text style={[TYPE.rowStrong, { color: DARK.ink }]}>Use max</Text>
          </Pressable>
          <View style={styles.source}>
            <Text style={[TYPE.rowDetail, { color: DARK.ink }]}>Wallet {amountOf(asset, source.wallet)}</Text>
            {source.trading > 0n ? (
              <Text style={[TYPE.rowDetail, { color: DARK.ink }]}>
                From free trading balance {amountOf(asset, source.trading)}
              </Text>
            ) : null}
            {asset.trading > asset.tradingFree ? (
              <Pressable onPress={onTrades} accessibilityRole="link">
                <Text style={[TYPE.meta, { color: DARK.link }]}>
                  {amountOf(asset, asset.trading - asset.tradingFree)} locked in trades ›
                </Text>
              </Pressable>
            ) : null}
            {asset.native ? <Text style={[TYPE.meta, { color: DARK.text2 }]}>10 MON stays for fees</Text> : null}
          </View>
          <Pressable
            onPress={onRecipient}
            accessibilityRole="button"
            accessibilityLabel="Choose recipient"
            style={[styles.recipient, { borderColor: DARK.border }]}
          >
            <Text style={[TYPE.rowDetail, { color: DARK.text2 }]}>To</Text>
            <Text style={[TYPE.rowStrong, { color: DARK.ink }]}>{recipient ?? "Choose a person or address"} ›</Text>
          </Pressable>
          {reason ? (
            <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: DARK.down }]}>
              {reason}
            </Text>
          ) : null}
          {warnings.map((warning) => (
            <Text key={warning} style={[TYPE.meta, styles.center, { color: DARK.warn }]}>
              {warning}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                fire("tick");
                input.key(key);
              }}
              accessibilityRole="keyboardkey"
              accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Decimal point" : key}
              style={({ pressed }) => [
                styles.key,
                { borderColor: color.paperInk, backgroundColor: pressed ? color.paper : color.transparent },
              ]}
            >
              {key === "del" ? (
                <Delete size={SIZE.icon} color={color.paperInk} />
              ) : (
                <Text style={[TYPE.sheetHeading, { color: color.paperInk }]}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
        <Button
          label={reason ?? (recipient ? "Review send" : "Choose recipient")}
          disabled={reason !== undefined}
          onPress={recipient ? onReview : onRecipient}
        />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter, gap: SPACE.md, flexGrow: 1 },
  heading: { textAlign: "center", transform: [{ rotate: "-5deg" }], marginBottom: SPACE.sm },
  ticket: { borderRadius: RADIUS.sm, padding: SPACE.lg, gap: SPACE.sm },
  center: { textAlign: "center" },
  chip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    borderRadius: RADIUS.pill,
    padding: SPACE.sm,
  },
  max: { alignSelf: "center", padding: SPACE.sm },
  source: { gap: SPACE.xxs, paddingVertical: SPACE.sm },
  recipient: { borderTopWidth: 1, paddingTop: SPACE.md, gap: SPACE.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: SPACE.sm },
  key: {
    width: "30%",
    minHeight: SIZE.touch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADIUS.xs,
  },
});
