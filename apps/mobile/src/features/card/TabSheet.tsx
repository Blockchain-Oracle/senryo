import { type ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Sheet } from "~/components/sheet/Sheet";
import { useDock } from "~/components/shell/dock-context";

/**
 * A compact sheet over a tab root: rendered at the screen's root (so it covers the whole page, not the scroll content)
 * and holding the floating dock hidden while it is up, so the sheet's bottom rows are never under the dock.
 */
export function TabSheet({
  id,
  onClose,
  closeLabel,
  dismissible,
  children,
}: {
  id: string;
  onClose: () => void;
  closeLabel: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const { hide, show } = useDock();
  useEffect(() => {
    hide(id);
    return () => show(id);
  }, [hide, show, id]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sheet onClose={onClose} closeLabel={closeLabel} {...(dismissible === undefined ? {} : { dismissible })}>
        {children}
      </Sheet>
    </View>
  );
}
