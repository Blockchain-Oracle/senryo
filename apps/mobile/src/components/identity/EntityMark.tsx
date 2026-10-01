import { type EntityMarkProps, EntityMark as Mark } from "@senryo/identity/native";
import { useTheme } from "~/theme";
import { identityTheme } from "~/theme/identity";

/**
 * The app's EntityMark: `@senryo/identity`'s mark bound to the current theme. `ground` is the surface it sits on
 * (for the badge cut-out); it defaults to the panel colour.
 */
export function EntityMark({ ground, ...props }: Omit<EntityMarkProps, "theme"> & { ground?: string }) {
  const { color, name } = useTheme();
  return <Mark {...props} theme={identityTheme(color, name, ground)} />;
}
