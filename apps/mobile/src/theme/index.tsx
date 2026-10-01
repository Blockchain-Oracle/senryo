import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DARK, LIGHT, type Palette } from "./palette";

export * from "./layout";
export * from "./motion";
export type { Palette } from "./palette";
export { FONT, HERO_FONT_SCALE, NUMERIC_VARIANT, TYPE } from "./type";

export type ThemeName = "dark" | "light";

interface ThemeValue {
  name: ThemeName;
  color: Palette;
  /** null follows the system again. */
  setTheme: (name: ThemeName | null) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** A stored choice wins over the system setting; Living Lacquer defaults to dark. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [stored, setStored] = useMMKVString(STORAGE_KEYS.theme, storage);
  const name: ThemeName = stored === "light" || stored === "dark" ? stored : system === "light" ? "light" : "dark";
  const value = useMemo<ThemeValue>(
    () => ({ name, color: name === "dark" ? DARK : LIGHT, setTheme: (next) => setStored(next ?? undefined) }),
    [name, setStored],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme outside ThemeProvider");
  return value;
}
