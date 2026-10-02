/**
 * The daily-limit review (E1 step 4, E3): the limit as a large static number (review amounts never roll), "a day ·
 * for 30 days" under it, the four preset chips, and the slide (D-235) that signs it behind a passkey. The reviewed
 * intent (chain, account, limit, mode) is the slide's `resetKey` and the review guard's: any change cancels a slide in
 * progress, and a change during signing is refused.
 */
import { ONE_USD6 } from "@senryo/core";
import { StyleSheet, Text, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { usd } from "~/lib/money";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { CARD_LIMIT_CHIPS_USD, DEFAULT_LIMIT_USD } from "./constants";
import { ALLOWANCE_DAYS } from "./useCardAllowance";

/** The preset to start from: the last limit when it is one of the chips, else $100. */
export function initialLimit(lastDailyUsd6: bigint | undefined): bigint {
  const whole = lastDailyUsd6 !== undefined ? lastDailyUsd6 / ONE_USD6 : undefined;
  return CARD_LIMIT_CHIPS_USD.find((chip) => chip === whole) ?? DEFAULT_LIMIT_USD;
}

export function LimitPicker({
  value,
  onChange,
  slideLabel,
  onConfirm,
  resetKey,
  busy,
  disabled,
}: {
  /** Whole dollars, one of CARD_LIMIT_CHIPS_USD. */
  value: bigint;
  onChange: (next: bigint) => void;
  slideLabel: string;
  onConfirm: () => void;
  resetKey: string;
  busy: boolean;
  disabled: boolean;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.amount}>
        <Text
          maxFontSizeMultiplier={HERO_FONT_SCALE}
          accessibilityLabel={`${usd(value * ONE_USD6, 0)} a day`}
          style={[TYPE.displayBalance, { color: color.ink }]}
        >
          {usd(value * ONE_USD6, 0)}
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>A day · for {String(ALLOWANCE_DAYS)} days</Text>
      </View>
      <View style={styles.chips}>
        <ChipRow
          options={CARD_LIMIT_CHIPS_USD.map((l) => ({ value: String(l), label: usd(l * ONE_USD6, 0) }))}
          value={String(value)}
          onChange={(v) => onChange(BigInt(v))}
          label="Daily limit"
        />
      </View>
      <SlideToConfirm label={slideLabel} resetKey={resetKey} busy={busy} disabled={disabled} onConfirm={onConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xl },
  amount: { alignItems: "center", gap: SPACE.xs },
  chips: { alignItems: "center" },
});
