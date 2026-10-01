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
/** How far a long holder name may shrink to fit the lacquer before it truncates. */
const HOLDER_MIN_SCALE = 0.75;

/**
 * Kinpaku card face (flip in S10). The PAN is always masked here; the full number shows only in the step-up
 * `card-reveal` sheet (S10), never logged. The printing is part of the card, sized to it, so it doesn't follow
 * Dynamic Type (VoiceOver reads the card's label).
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
      <Image source={CARD_ART} style={styles.art} resizeMode="contain" />
      <View style={[styles.overlay, OVERLAY]}>
        <View style={styles.top}>
          <Text allowFontScaling={false} style={[TYPE.numMd, { color: color.onLacquer }]}>
            •••• {last4}
          </Text>
          <View style={styles.right}>
            <Text allowFontScaling={false} style={[TYPE.meta, { color: color.onLacquerMuted }]}>
              Expires
            </Text>
            <Text allowFontScaling={false} style={[TYPE.numSm, { color: color.onLacquer }]}>
              {expires}
            </Text>
          </View>
        </View>
        {/* The holder has the lacquer's full width; a long name shrinks a little before it is cut. */}
        <View>
          <Text allowFontScaling={false} style={[TYPE.meta, { color: color.onLacquerMuted }]}>
            Card holder
          </Text>
          <Text
            allowFontScaling={false}
            style={[TYPE.numSm, { color: color.onLacquer }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={HOLDER_MIN_SCALE}
          >
            {holder}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: SIZE.cardAspect, overflow: "hidden" },
  // Explicit size: a bundled image otherwise keeps its own pixel size, however it is positioned.
  art: { position: "absolute", width: "100%", height: "100%" },
  overlay: { position: "absolute", right: SPACE.xl, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACE.sm },
  right: { alignItems: "flex-end" },
});
