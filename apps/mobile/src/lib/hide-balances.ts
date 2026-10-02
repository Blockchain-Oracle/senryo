/**
 * Hide balances (A10): when on, amounts on Home, Assets and Card read "••••". The choice stays on this phone (a display
 * choice, kept by "Delete my data"). Screens read `useHideBalances()` and pass amounts through `masked()`; the Home
 * hero's long-press toggles it.
 */
import { useMMKVBoolean } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export const HIDDEN_AMOUNT = "••••";

export function useHideBalances(): [hidden: boolean, setHidden: (next: boolean) => void] {
  const [hidden, setHidden] = useMMKVBoolean(STORAGE_KEYS.hideBalances, storage);
  return [hidden === true, (next) => setHidden(next)];
}

export function masked(text: string, hidden: boolean): string {
  return hidden ? HIDDEN_AMOUNT : text;
}
