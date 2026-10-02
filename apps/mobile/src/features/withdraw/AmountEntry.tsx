/**
 * The amount of a send or withdrawal (review S02, F23): the exact figure typed in its own field, in this network's
 * money, with 25 % / 50 % / All of the available amount as presets that fill it. The line under the field says what can
 * leave now, or that the typed amount is more than that. The presets never become the only control.
 */
import { RISK } from "@senryo/core";
import { StyleSheet, View } from "react-native";
import { Preset } from "~/components/trade/Preset";
import { COLLATERAL_STEPS_BPS as SHARES_BPS } from "~/features/portfolio/constants";
import { SetupField } from "~/features/setup/SetupField";
import { moneySymbol, pct, usd } from "~/lib/money";
import { SPACE } from "~/theme";
import type { useAmountDraft } from "./amount-draft";

export function AmountEntry({
  draft,
  max,
  symbol,
  label,
}: {
  draft: ReturnType<typeof useAmountDraft>;
  max: bigint;
  symbol: string;
  /** The field's accessible name ("Amount to send"). */
  label: string;
}) {
  return (
    <View style={styles.stack}>
      <SetupField
        label={label}
        value={draft.text}
        onChangeText={draft.setText}
        placeholder="0.00"
        prefix={moneySymbol()}
        {...(draft.text ? { action: { label: "Clear", onPress: draft.reset } } : {})}
        message={
          draft.over
            ? `Only ${usd(max)} ${symbol} available`
            : draft.all
              ? `All of it: ${usd(max)} ${symbol}`
              : `Up to ${usd(max)} ${symbol} available`
        }
        tone={draft.over ? "bad" : "quiet"}
        input={{ keyboardType: "decimal-pad", returnKeyType: "done" }}
      />
      <View style={styles.presets}>
        {SHARES_BPS.map((b) => {
          const name = b >= RISK.BPS ? "Max" : pct(b);
          return (
            <Preset
              key={String(b)}
              label={name}
              accessibilityLabel={`${name} of the available amount`}
              disabled={max === 0n}
              onPress={() => draft.setShare(b)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  presets: { flexDirection: "row", gap: SPACE.sm },
});
