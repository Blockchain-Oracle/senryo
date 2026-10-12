/**
 * Hide balances (A10 → R5.14): when on, every balance and result reads "••••" — Home, the terminal's equity and close
 * value, positions and the pill, the chart's PnL, Calls, and the amounts in toasts; sharing a result waits until they
 * show. The choice stays on this phone (a display choice, kept by "Delete my data"). Screens read `useHideBalances()`
 * and pass amounts through `masked()` (live odometers take `sensitive`).
 */
import { useMMKVBoolean } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export const HIDDEN_AMOUNT = "••••";

export function useHideBalances(): [hidden: boolean, setHidden: (next: boolean) => void] {
  const [hidden, setHidden] = useMMKVBoolean(STORAGE_KEYS.hideBalances, storage);
  return [hidden === true, (next) => setHidden(next)];
}

/** Read outside React (a toast raised from a flow). */
export const balancesHidden = (): boolean => storage.getBoolean(STORAGE_KEYS.hideBalances) === true;

export function masked(text: string, hidden: boolean): string {
  return hidden ? HIDDEN_AMOUNT : text;
}
