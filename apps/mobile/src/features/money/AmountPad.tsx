/**
 * The amount step (B0.2; Fomo F23/F37, Phantom P20): the typed amount large in the middle — in the asset's units or in
 * $ (tap to switch where the asset is priced) with the other figure under it — the available line with the path that
 * frees a locked part ("Available 212.00 · 300.00 in trades ›"), 25% · 50% · Max, and the keypad. Max is the exact
 * spendable amount (the MON fee reserve already kept out). Input only: never a rolling hero (rule 7).
 */
import { RISK } from "@senryo/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowDownUp } from "~/components/kit/symbols";
import { Keypad } from "~/components/trade/Keypad";
import { Preset } from "~/components/trade/Preset";
import { fire } from "~/feedback/fire";
import { moneySymbol, usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { AmountInput } from "./amount";
import type { MoneyAsset } from "./assets";
import { amountOf } from "./format";

const HALF_BPS = 5_000n;
const QUARTER_BPS = 2_500n;
const KEYPAD_HEIGHT = 248;

export function AmountPad({
  asset,
  input,
  available,
  locked,
  minimum,
}: {
  asset: Pick<MoneyAsset, "symbol" | "decimals">;
  input: AmountInput;
  available: bigint;
  /** The part that can't leave now and the path that frees it ("300.00 in trades ›"). */
  locked?: { text: string; onPress: () => void } | undefined;
  /** A route minimum, shown inline when the amount is under it. */
  minimum?: { raw: bigint; text: string } | undefined;
}) {
  const { color } = useTheme();
  const usdMode = input.mode === "usd";
  const hero = usdMode ? `${moneySymbol()}${input.text || "0"}` : `${input.text || "0"} ${asset.symbol}`;
  const under = usdMode ? amountOf(asset, input.amount) : input.usd6 !== null ? usd(input.usd6) : undefined;
  const below = minimum !== undefined && input.amount > 0n && input.amount < minimum.raw;
  const line = input.over
    ? `Only ${amountOf(asset, available)} available`
    : below
      ? `Minimum ${minimum.text}`
      : `Available ${amountOf(asset, available)}`;
  return (
    <View style={styles.stack}>
      <Pressable
        onPress={() => {
          if (input.usd6 === null) return;
          fire("tick");
          input.toggleMode();
        }}
        disabled={input.usd6 === null}
        accessibilityRole="adjustable"
        accessibilityLabel={`Amount ${hero}${under ? `, about ${under}` : ""}`}
        accessibilityHint={input.usd6 === null ? undefined : "Switches between the token and dollars"}
        style={styles.hero}
      >
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[TYPE.displayBalance, { color: input.text ? color.ink : color.text3 }]}
        >
          {hero}
        </Text>
        {under ? (
          <View style={styles.under}>
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowChange, { color: color.text2 }]}>
              ≈ {under}
            </Text>
            <ArrowDownUp size={SIZE.iconSm} color={color.text3} />
          </View>
        ) : null}
      </Pressable>
      <View style={styles.lineRow}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          accessibilityLiveRegion="polite"
          style={[TYPE.rowDetail, { color: input.over || below ? color.down : color.text3 }]}
        >
          {line}
        </Text>
        {locked ? (
          <Pressable onPress={locked.onPress} accessibilityRole="link" hitSlop={SPACE.sm}>
            <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.link }]}>
              · {locked.text} ›
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.presets}>
        <Preset
          label="25%"
          accessibilityLabel="25% of what is available"
          disabled={available === 0n}
          onPress={() => input.fillShare(QUARTER_BPS, RISK.BPS)}
        />
        <Preset
          label="50%"
          accessibilityLabel="Half of what is available"
          disabled={available === 0n}
          onPress={() => input.fillShare(HALF_BPS, RISK.BPS)}
        />
        <Preset
          label="Max"
          accessibilityLabel="All that can leave"
          disabled={available === 0n}
          onPress={input.fillMax}
        />
      </View>
      <View style={styles.keypad}>
        <Keypad onKey={input.key} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  hero: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.md },
  under: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  lineRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: SPACE.xs },
  presets: { flexDirection: "row", gap: SPACE.sm },
  keypad: { height: KEYPAD_HEIGHT },
});
