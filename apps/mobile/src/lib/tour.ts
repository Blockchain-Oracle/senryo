/**
 * When the terminal's tour shows on the phone (R5.15; the web's `lib/terminal/tour.ts`): once on the first terminal
 * visit on this phone, and whenever Settings asks for it. `TourHost` reads it; the seen flag lives in MMKV.
 */
import { useSyncExternalStore } from "react";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

let open = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const set = (next: boolean) => {
  open = next;
  for (const l of listeners) l();
};

export const openTour = (): void => set(true);
export const closeTour = (): void => set(false);

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

/** [seen, markSeen]: the first terminal visit opens the tour while this is false. */
export function useTourSeen(): [boolean, () => void] {
  const [value, setValue] = useMMKVString(STORAGE_KEYS.terminalTour, storage);
  return [value === "seen", () => setValue("seen")];
}
