import { StyleSheet, Text } from "react-native";
import { SPACE, TYPE, useTheme } from "~/theme";

/** Fomo F12 / F32 measure the "20x" plate at 17 pt high with 5 pt corners — a small rounded rectangle, not a pill. */
const BADGE_RADIUS = 5;
const BADGE_PAD_X = SPACE.xs + SPACE.xxs;

/**
 * A small tinted badge beside a name (Fomo's "10x", "New", "4x Long"): 12 pt semibold ink on a tinted plate, no
 * outline. `label` is what VoiceOver reads when the text alone would not say it.
 */
export function TintBadge({ text, ink, fill, label }: { text: string; ink: string; fill: string; label?: string }) {
  return (
    <Text
      {...(label ? { accessibilityLabel: label } : {})}
      style={[TYPE.label, styles.plate, { color: ink, backgroundColor: fill }]}
    >
      {text}
    </Text>
  );
}

/**
 * The max-leverage badge beside a tradeable market's name (Fomo F11/F12 rows, F32 header): "20×" in link ink on the
 * tinted blue plate. The number is the market's own `maxLeverageX` (10 000 / initial-margin bps, read from the
 * engine); a market with no margin parameter shows no badge rather than a made-up one.
 */
export function LeverageBadge({ x }: { x: number }) {
  const { color } = useTheme();
  if (x <= 0) return null;
  return <TintBadge text={`${x}×`} ink={color.link} fill={color.mainnetSurface} label={`Up to ${x} times leverage`} />;
}

/** Long in the up colours, Short in the down colours (F32 Holders, F34 Feed) — the word carries it, not the colour. */
export function SideBadge({ side }: { side: "LONG" | "SHORT" }) {
  const { color } = useTheme();
  const long = side === "LONG";
  return (
    <TintBadge
      text={long ? "Long" : "Short"}
      ink={long ? color.up : color.down}
      fill={long ? color.upWash : color.downWash}
    />
  );
}

const styles = StyleSheet.create({
  plate: { paddingHorizontal: BADGE_PAD_X, borderRadius: BADGE_RADIUS, overflow: "hidden" },
});
