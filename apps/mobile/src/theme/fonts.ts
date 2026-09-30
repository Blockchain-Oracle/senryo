import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
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
