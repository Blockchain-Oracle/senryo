import { SIZE, useTheme } from "~/theme";
import { ICONS, type IconName } from "./icons";

/** A role-named native icon (see `icons.ts`); decorative. Tinted with the theme's ink unless given a colour. */
export function Icon({ name, size = SIZE.icon, tint }: { name: IconName; size?: number; tint?: string }) {
  const { color } = useTheme();
  const Glyph = ICONS[name];
  return <Glyph size={size} color={tint ?? color.ink} />;
}
