import { useFocusEffect } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCK, FAN, SPACE } from "~/theme";

/**
 * Shell chrome state (S1b.7, proven by the D-193 spike), as two sets of holders:
 * - `hidden`: a transaction-entry screen holds the dock (and the fan's plus) hidden while it is focused;
 * - `fan`: a tab root holds the fan's plus visible while it is focused — the plus lives on the five tab roots only
 *   (Codex S1b.7 consult #5), so a pushed page, a child or a ticket never shows it.
 * Content asks `useDockInset()` for the bottom padding that keeps every action clear of the dock (and of the plus on
 * a root): Fomo's deposit/dock overlap (X03) is the defect we fix (direction §5).
 */
interface DockState {
  hidden: boolean;
  fan: boolean;
  hide: (key: string) => void;
  show: (key: string) => void;
  holdFan: (key: string) => void;
  releaseFan: (key: string) => void;
}

const DockContext = createContext<DockState | null>(null);

function useHolders() {
  const [holders, setHolders] = useState<ReadonlySet<string>>(() => new Set());
  const add = useCallback((key: string) => setHolders((prev) => (prev.has(key) ? prev : new Set(prev).add(key))), []);
  const remove = useCallback(
    (key: string) =>
      setHolders((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    [],
  );
  return [holders.size > 0, add, remove] as const;
}

export function DockProvider({ children }: { children: ReactNode }) {
  const [hidden, hide, show] = useHolders();
  const [fan, holdFan, releaseFan] = useHolders();
  const value = useMemo(
    () => ({ hidden, fan, hide, show, holdFan, releaseFan }),
    [hidden, fan, hide, show, holdFan, releaseFan],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

/** Outside the tab shell (root pages, sheets) there is no dock: a no-op state that is never hidden. */
const NO_DOCK: DockState = {
  hidden: false,
  fan: false,
  hide: () => undefined,
  show: () => undefined,
  holdFan: () => undefined,
  releaseFan: () => undefined,
};

export function useDock(): DockState {
  return useContext(DockContext) ?? NO_DOCK;
}

/** True inside the five-tab shell (a tab root or a page pushed on a tab's stack). */
export function useInShell(): boolean {
  return useContext(DockContext) !== null;
}

/** Transaction entry (the ticket): the dock and the fan's plus stay hidden while this screen is focused. */
export function useHideDockWhileFocused(key: string) {
  const { hide, show } = useDock();
  useFocusEffect(
    useCallback(() => {
      hide(key);
      return () => show(key);
    }, [hide, show, key]),
  );
}

/** A tab root: the fan's plus shows while this screen is focused. */
export function useFanWhileFocused(key: string) {
  const { holdFan, releaseFan } = useDock();
  useFocusEffect(
    useCallback(() => {
      holdFan(key);
      return () => releaseFan(key);
    }, [holdFan, releaseFan, key]),
  );
}

/**
 * Bottom padding for scroll content: safe area + the dock's footprint (92) — plus the fan's plus and its gap on a tab
 * root (156 in all, Codex consult #5) — so the last row always scrolls clear. Outside the shell, or while the dock is
 * hidden, a plain gap.
 */
export function useDockInset({ root = false }: { root?: boolean } = {}): number {
  const insets = useSafeAreaInsets();
  const inShell = useInShell();
  const { hidden } = useDock();
  if (!inShell || hidden) return insets.bottom + SPACE.xl;
  return insets.bottom + DOCK.contentBottom + (root ? FAN.trigger + SPACE.lg : 0);
}
