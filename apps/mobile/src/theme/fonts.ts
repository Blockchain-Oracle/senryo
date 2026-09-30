// Per-weight subpaths, so only these seven faces are bundled (the package index pulls every weight and italic).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono/600SemiBold";
import { useFonts } from "expo-font";

/** The D2 faces, keyed by the names `type.ts` uses. */
const FACES = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
};

/** The chart's axis face (Skia loads its own copy of the file). */
export const CHART_FONT = JetBrainsMono_400Regular;

/** True once every face is ready — or failed: the system face stands in rather than holding the splash forever. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
