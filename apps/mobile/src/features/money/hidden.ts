/**
 * Hidden tokens (B14): the addresses an account chose to hide on a network. Kept on this phone per account and network
 * until the server copy (BD-5, `GET/PUT /v1/destinations`'s sibling) exists; a hidden token leaves Other tokens and
 * Activity and sits under "Hidden (n)", where it can be shown again.
 */
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

type HiddenBook = Record<string, string[]>;

function parse(raw: string | undefined): HiddenBook {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as HiddenBook) : {};
  } catch {
    return {};
  }
}

export function useHiddenTokens(chainId: number, account: string | undefined) {
  const [raw, setRaw] = useMMKVString(STORAGE_KEYS.hiddenTokens, storage);
  const scope = `${chainId}:${account?.toLowerCase() ?? "guest"}`;
  const book = parse(raw);
  const list = new Set(book[scope] ?? []);
  const write = (next: Set<string>) => setRaw(JSON.stringify({ ...book, [scope]: [...next] }));
  return {
    has: (address: string) => list.has(address.toLowerCase()),
    hide: (address: string) => write(new Set([...list, address.toLowerCase()])),
    show: (address: string) => write(new Set([...list].filter((a) => a !== address.toLowerCase()))),
  };
}
