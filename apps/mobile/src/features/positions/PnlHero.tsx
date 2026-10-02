import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountHero } from "~/components/kit/AmountHero";
import { Info } from "~/components/kit/symbols";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { DetailRow } from "~/features/markets/Disclosure";
import { fire } from "~/feedback/fire";
import { signedUsd } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Unrealised P&L net of funding and borrow: positive means the position is up. */
export const netPnl = (priceUsd6: bigint, fundingUsd6: bigint, borrowUsd6: bigint) =>
  priceUsd6 - fundingUsd6 - borrowUsd6;

/**
 * The position's one hero (flow book C5 step 1; plan §0.9 Position): the unrealised P&L net of funding and borrow,
 * signed and coloured by **profit** (≥ 0 green, < 0 red — never by side, C3a colour rule), with rolling digits. The
 * ⓘ opens what it is made of.
 */
export function PnlHero({
  priceUsd6,
  fundingUsd6,
  borrowUsd6,
  onInfo,
}: {
  /** Unrealised P&L from the price alone, at the conservative exit. */
  priceUsd6: bigint;
  /** Funding and borrow owed (positive = the position pays). */
  fundingUsd6: bigint;
  borrowUsd6: bigint;
  onInfo: () => void;
}) {
  const { color } = useTheme();
  const net = netPnl(priceUsd6, fundingUsd6, borrowUsd6);
  return (
    <View style={styles.hero}>
      <Pressable
        onPress={() => {
          fire("tick");
          onInfo();
        }}
        accessibilityRole="button"
        accessibilityLabel="What the P&L is made of"
        hitSlop={SPACE.sm}
        style={styles.label}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
          Unrealised P&L
        </Text>
        <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
      </Pressable>
      <AmountHero
        text={signedUsd(net)}
        role={TYPE.displayPrice}
        color={net < 0n ? color.down : color.up}
        dimDecimals={false}
        accessibilityLabel={`Unrealised ${net < 0n ? "loss" : "profit"} ${signedUsd(net)}`}
      />
    </View>
  );
}

/** The P&L's parts (ⓘ): the price move at the conservative exit, funding and borrow since the last settle. */
export function PnlParts({
  open,
  onClose,
  priceUsd6,
  fundingUsd6,
  borrowUsd6,
}: {
  open: boolean;
  onClose: () => void;
  priceUsd6: bigint;
  fundingUsd6: bigint;
  borrowUsd6: bigint;
}) {
  const { color } = useTheme();
  const net = netPnl(priceUsd6, fundingUsd6, borrowUsd6);
  return (
    <ChildSheet open={open} onClose={onClose} title="Unrealised P&L">
      <View>
        <DetailRow label="Price" value={signedUsd(priceUsd6)} />
        <DetailRow label="Funding" value={signedUsd(-fundingUsd6)} />
        <DetailRow label="Borrow" value={signedUsd(-borrowUsd6)} />
        <DetailRow label="Net" value={signedUsd(net)} tone={net < 0n ? color.down : color.up} />
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>At the price you would close at now.</Text>
    </ChildSheet>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACE.xs },
  label: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, alignSelf: "flex-start" },
});
