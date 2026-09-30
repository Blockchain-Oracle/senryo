import { SymbolView } from "expo-symbols";
import { SIZE, useTheme } from "~/theme";
import { ICONS, type IconName } from "./icons";

/** SF Symbols on iOS, Material Symbols on Android (expo-symbols); decorative unless given a label. */
export function Icon({ name, size = SIZE.icon, tint }: { name: IconName; size?: number; tint?: string }) {
  const { color } = useTheme();
  const glyph = ICONS[name];
  return <SymbolView name={{ ios: glyph.sf, android: glyph.md }} size={size} tintColor={tint ?? color.ink} />;
}
