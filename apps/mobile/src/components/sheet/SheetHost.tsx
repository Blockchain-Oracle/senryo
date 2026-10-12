/**
 * The sheets' layer (D-321): one host at the root, above every stack screen — the tab shell and its floating dock
 * included — where a `Sheet` opened inside the shell renders, so its scrim covers the whole screen (the terminal's
 * ticket too) and nothing draws over its panel. A sheet that already lives in a native modal (a `(sheets)/` route, or
 * an RN `Modal`) renders in place: the root layer sits under native modals. `SheetInPlace` marks those.
 */
import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

interface Portal {
  set: (id: string, node: ReactNode) => void;
  remove: (id: string) => void;
}

const PortalContext = createContext<Portal | null>(null);
const InPlaceContext = createContext(false);

/** Wraps the root stack; the layer renders right after it, under the toasts and the other root hosts. */
export function SheetPortalProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly { id: string; node: ReactNode }[]>([]);
  const portal = useMemo<Portal>(
    () => ({
      set: (id, node) =>
        setEntries((prev) => {
          const at = prev.findIndex((e) => e.id === id);
          if (at < 0) return [...prev, { id, node }];
          const next = [...prev];
          next[at] = { id, node };
          return next;
        }),
      remove: (id) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    }),
    [],
  );
  return (
    <PortalContext.Provider value={portal}>
      {children}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {entries.map((e) => (
          <View key={e.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {e.node}
          </View>
        ))}
      </View>
    </PortalContext.Provider>
  );
}

/** Sheets under this render where they are (inside an RN `Modal` or a native modal route). */
export function SheetInPlace({ children }: { children: ReactNode }) {
  return <InPlaceContext.Provider value>{children}</InPlaceContext.Provider>;
}

export function useSheetInPlace(): boolean {
  return useContext(InPlaceContext);
}

/** Renders `node` in the root layer while mounted (re-sent on every render, so it stays current). */
export function SheetPortal({ id, children }: { id: string; children: ReactNode }) {
  const portal = useContext(PortalContext);
  useLayoutEffect(() => {
    portal?.set(id, children);
  });
  useLayoutEffect(() => () => portal?.remove(id), [portal, id]);
  return portal ? null : children;
}
