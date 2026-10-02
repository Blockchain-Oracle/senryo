import { useFonts } from "expo-font";
import { Platform } from "react-native";

/**
 * Living Lacquer faces (D-192), loaded at runtime through expo-font from the vendored files in assets/fonts. Inter
 * 400–700 and Inter Display SemiBold are byte-for-byte from the official Inter 4.1 release; Noto Sans JP is instanced and
 * subset to the Japanese glyphs we ship (千両金箔). Provenance + sha256 in `packages/tokens/src/fonts.ts` (invariant
 * font-provenance). Keys are the family names `type.ts` uses.
 */
const FACES = {
  Inter_400Regular: require("../../assets/fonts/Inter-Regular.ttf"),
  Inter_500Medium: require("../../assets/fonts/Inter-Medium.ttf"),
  Inter_600SemiBold: require("../../assets/fonts/Inter-SemiBold.ttf"),
  Inter_700Bold: require("../../assets/fonts/Inter-Bold.ttf"),
  InterDisplay_600SemiBold: require("../../assets/fonts/InterDisplay-SemiBold.ttf"),
  NotoSansJP_400Regular: require("../../assets/fonts/NotoSansJP-Regular-subset.ttf"),
  NotoSansJP_500Medium: require("../../assets/fonts/NotoSansJP-Medium-subset.ttf"),
  NotoSansJP_600SemiBold: require("../../assets/fonts/NotoSansJP-SemiBold-subset.ttf"),
  NotoSansJP_700Bold: require("../../assets/fonts/NotoSansJP-Bold-subset.ttf"),
  // Android utility icons draw from this face (components/kit/symbols.tsx); iOS uses SF Symbols, so it never loads there.
  ...(Platform.OS === "android"
    ? { MaterialSymbols_400Regular: require("../../assets/fonts/MaterialSymbols-Regular.ttf") }
    : {}),
};

/** The chart's axis face (Skia loads its own copy of the file); axis figures are drawn with Inter. */
export const CHART_FONT = FACES.Inter_400Regular;

/** True once every face is ready — or failed: the system face stands in rather than holding the splash forever. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
