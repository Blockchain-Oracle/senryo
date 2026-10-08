import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "~/theme";

/** Owned sky, independent of art decode or account access. Caption contrast is supplied separately. */
export function WelcomeBackdrop() {
  const { color } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: color.welcomeSky }]}
    >
      <Image
        source={require("../../../assets/onboarding/welcome-sky.png")}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
      />
    </View>
  );
}

const CAPTION_LARGE_SCALE = 1.1;
const CAPTION_COMPACT_HEIGHT = 700;
const CAPTION_BLUE_SHADE = 0.56;
const CAPTION_CLOUD_SHADE = 0.68;

/** Full-width soft sky shade localized to the caption, never an inset card. */
export function WelcomeCaptionShade({ height }: { height: number }) {
  const { color } = useTheme();
  const { width, height: viewportHeight, fontScale } = useWindowDimensions();
  const fade = 100;
  const total = height + fade * 2;
  const opacity =
    fontScale > CAPTION_LARGE_SCALE || viewportHeight < CAPTION_COMPACT_HEIGHT
      ? CAPTION_CLOUD_SHADE
      : CAPTION_BLUE_SHADE;
  return (
    <Svg
      pointerEvents="none"
      accessibilityElementsHidden
      width={width}
      height={total}
      style={{ position: "absolute", left: 0, top: -fade }}
    >
      <Defs>
        <LinearGradient id="caption-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.welcomeShade} stopOpacity={0} />
          <Stop offset={fade / total} stopColor={color.welcomeShade} stopOpacity={opacity} />
          <Stop offset={(fade + height) / total} stopColor={color.welcomeShade} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color.welcomeShade} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#caption-shade)" />
    </Svg>
  );
}
