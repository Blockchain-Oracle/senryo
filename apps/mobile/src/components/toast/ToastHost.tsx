import { Toaster } from "sonner-native";
import { HAIRLINE_PX, RADIUS, TYPE, useTheme } from "~/theme";

/** One toast at a time, bottom, above the tab bar; D2 plate (card ground, hairline, 4 px corners). */
const VISIBLE_TOASTS = 1;

export function ToastHost() {
  const { name, color } = useTheme();
  return (
    <Toaster
      position="bottom-center"
      visibleToasts={VISIBLE_TOASTS}
      theme={name}
      swipeToDismissDirection="left"
      toastOptions={{
        style: {
          backgroundColor: color.card,
          borderColor: color.hairline,
          borderWidth: HAIRLINE_PX,
          borderRadius: RADIUS.sm,
        },
        titleStyle: { ...TYPE.bodyStrong, color: color.ink },
        descriptionStyle: { ...TYPE.body, color: color.inkMuted },
      }}
    />
  );
}
