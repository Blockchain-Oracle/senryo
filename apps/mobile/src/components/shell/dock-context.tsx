import { useFocusEffect, usePathname } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useMMKVString } from "react-native-mmkv";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DOCK, dockBottom, SPACE } from "~/theme";

/** Route context and transactional visibility; content always clears the dock footprint. */
export type ShellContext = "money" | "trade" | "social";

interface DockState {
  context: ShellContext;
  setContext: (context: ShellContext) => void;
  hidden: boolean;
  hide: (key: string) => void;
  show: (key: string) => void;
}

const DockContext = createContext<DockState | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [holders, setHolders] = useState<ReadonlySet<string>>(() => new Set());
  const hide = useCallback((key: string) => setHolders((prev) => (prev.has(key) ? prev : new Set(prev).add(key))), []);
  const show = useCallback(
    (key: string) =>
      setHolders((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    [],
  );
  const [stored, setContext] = useMMKVString(STORAGE_KEYS.shellContext, storage);
  const pathname = usePathname();
  const remembered: ShellContext = stored === "trade" || stored === "social" ? stored : "money";
  const context: ShellContext = pathname.startsWith("/markets")
    ? "trade"
    : pathname.startsWith("/social")
      ? "social"
      : pathname === "/home" || pathname.startsWith("/card")
        ? "money"
        : remembered;
  const hidden = holders.size > 0;
  const value = useMemo(() => ({ hidden, hide, show, context, setContext }), [hidden, hide, show, context, setContext]);
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

/** Outside the tab shell (root pages, sheets) there is no dock: a no-op state that is never hidden. */
const NO_DOCK: DockState = {
  context: "money",
  setContext: () => undefined,
  hidden: false,
  hide: () => undefined,
  show: () => undefined,
};

export function useDock(): DockState {
  return useContext(DockContext) ?? NO_DOCK;
}

/** True inside the five-tab shell (a tab root or a page pushed on a tab's stack). */
export function useInShell(): boolean {
  return useContext(DockContext) !== null;
}

/** Transaction entry holds the dock hidden while focused. */
export function useHideDockWhileFocused(key: string) {
  const { hide, show } = useDock();
  useFocusEffect(
    useCallback(() => {
      hide(key);
      return () => show(key);
    }, [hide, show, key]),
  );
}

/**
 * Bottom padding for scroll content: the safe area plus the dock row's footprint, so the last row always scrolls clear
 * of the dock. Outside the shell, or while the dock is hidden, a plain gap.
 */
export function useDockInset(): number {
  const insets = useSafeAreaInsets();
  const inShell = useInShell();
  const { hidden } = useDock();
  if (!inShell || hidden) return insets.bottom + SPACE.xl;
  return dockBottom(insets.bottom) + DOCK.height + SPACE.lg;
}
