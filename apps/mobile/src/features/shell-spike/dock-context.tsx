import { useFocusEffect } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCK, SPACE } from "~/theme";

/**
 * S1b.7 navigation spike (D-193): dock visibility as a set of holders. A transaction-entry screen (or sheet) holds the
 * dock hidden while it is focused; the dock reappears when the last holder lets go. Content asks `useDockInset()` for
 * the bottom padding that keeps every action clear of the dock (Fomo's overlap is a defect we fix, direction §5).
 */
interface DockState {
  hidden: boolean;
  hide: (key: string) => void;
  show: (key: string) => void;
}

const DockContext = createContext<DockState | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [holders, setHolders] = useState<ReadonlySet<string>>(() => new Set());
  const hide = useCallback((key: string) => setHolders((prev) => new Set(prev).add(key)), []);
  const show = useCallback(
    (key: string) =>
      setHolders((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    [],
  );
  const value = useMemo(() => ({ hidden: holders.size > 0, hide, show }), [holders, hide, show]);
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockState {
  const value = useContext(DockContext);
  if (!value) throw new Error("useDock outside DockProvider");
  return value;
}

/** Transaction entry: the dock stays hidden while this screen is focused. */
export function useHideDockWhileFocused(key: string) {
  const { hide, show } = useDock();
  useFocusEffect(
    useCallback(() => {
      hide(key);
      return () => show(key);
    }, [hide, show, key]),
  );
}

/** Bottom padding for scroll content: safe area + the dock's footprint (or a plain gap while the dock is hidden). */
export function useDockInset(): number {
  const insets = useSafeAreaInsets();
  const { hidden } = useDock();
  return insets.bottom + (hidden ? SPACE.lg : DOCK.contentBottom);
}
