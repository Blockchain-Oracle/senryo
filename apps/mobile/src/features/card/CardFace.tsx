import { StyleSheet, Text, View } from "react-native";
import { FONT, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Kinpaku card face (RN port of 21st Credit/Debit Card #5276, flip in S10). The PAN is always masked here; the full
 * number shows only in the step-up `card-reveal` sheet (S10), never logged.
 */
export function CardFace({ last4, holder, expires, route }: { last4: string; holder: string; expires: string; route: string }) {
  const { color } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Kinpaku card ending ${last4}, ${route}`}
      style={[styles.card, { backgroundColor: color.card, borderColor: color.hairline }]}
    >
      <View style={styles.top}>
        <View style={[styles.chip, { backgroundColor: color.gold }]} />
        <Text style={[styles.brand, { color: color.ink }]}>KINPAKU 金箔</Text>
      </View>
      <Text style={[TYPE.numLg, { color: color.ink }]}>•••• •••• •••• {last4}</Text>
      <View style={styles.bottom}>
        <View>
          <Text style={[TYPE.label, { color: color.inkMuted }]}>CARD HOLDER</Text>
          <Text style={[TYPE.numSm, { color: color.ink }]}>{holder}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[TYPE.label, { color: color.inkMuted }]}>EXPIRES</Text>
          <Text style={[TYPE.numSm, { color: color.ink }]}>{expires}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: SIZE.cardAspect,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    padding: SPACE.xl,
    justifyContent: "space-between",
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { width: SIZE.cardChipWidth, height: SIZE.cardChipHeight, borderRadius: RADIUS.sm },
  brand: { ...TYPE.bodyStrong, fontFamily: FONT.monoStrong },
  bottom: { flexDirection: "row", justifyContent: "space-between" },
  right: { alignItems: "flex-end" },
});
