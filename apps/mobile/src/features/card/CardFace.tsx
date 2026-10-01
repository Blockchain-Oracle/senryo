import { Image, StyleSheet, Text, View } from "react-native";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The Kinpaku art (brand/kinpaku-card.svg): gold leaf torn across lacquer, the seal stamped on the leaf, KINPAKU / 金箔
 * and SENRYO already in the artwork. Rendered from its raster (`brand/scripts/render.sh`) because the SVG's grain
 * filter doesn't draw in react-native-svg.
 */
const CARD_ART = require("../../../assets/images/kinpaku-card.png");

/** The number and holder sit on the lacquer (right half), above the bottom-right area kept for the network mark. */
const OVERLAY = { left: "52%", top: "30%", bottom: "30%" } as const;

/**
 * Kinpaku card face (flip in S10). The PAN is always masked here; the full number shows only in the step-up
 * `card-reveal` sheet (S10), never logged.
 */
export function CardFace({
  last4,
  holder,
  expires,
  route,
}: {
  last4: string;
  holder: string;
  expires: string;
  route: string;
}) {
  const { color } = useTheme();
  return (
    <View accessible accessibilityLabel={`Kinpaku card ending ${last4}, ${route}`} style={styles.card}>
      <Image source={CARD_ART} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <View style={[styles.overlay, OVERLAY]}>
        <Text style={[TYPE.numMd, { color: color.onLacquer }]}>•••• {last4}</Text>
        <View style={styles.bottom}>
          <View style={styles.flex}>
            <Text style={[TYPE.label, { color: color.onLacquerMuted }]}>CARD HOLDER</Text>
            <Text style={[TYPE.numSm, { color: color.onLacquer }]} numberOfLines={1}>
              {holder}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={[TYPE.label, { color: color.onLacquerMuted }]}>EXPIRES</Text>
            <Text style={[TYPE.numSm, { color: color.onLacquer }]}>{expires}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: SIZE.cardAspect },
  overlay: { position: "absolute", right: SPACE.xl, justifyContent: "space-between" },
  bottom: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm },
  flex: { flex: 1 },
  right: { alignItems: "flex-end" },
});
