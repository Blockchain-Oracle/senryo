/**
 * The watchlist follows the account (review: one stateless-restoration contract). At each unlock it reads the synced
 * list once: a newer one is adopted, an older one is replaced by this phone's. A star or unstar while the session is
 * live is pushed shortly after (debounced). Never a prompt — nothing syncs while trading is locked; guests keep theirs
 * on the phone. Recent searches stay this phone's own.
 */
import { useEffect, useRef } from "react";
import { useMMKVNumber } from "react-native-mmkv";
import { useAccount } from "~/lib/account/provider";
import { pullWatchlist, pushWatchlist } from "~/lib/account/remote";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { adoptWatchlist, localWatchlist } from "./device-store";

/** A burst of stars becomes one write. */
const PUSH_DEBOUNCE_MS = 2_000;

export function WatchlistSync() {
  const account = useAccount();
  const unlockedAs = account.snapshot.status === "unlocked" ? account.snapshot.address : undefined;
  const client = account.client;
  const faceId = account.settings.faceId;
  const [changedAt] = useMMKVNumber(STORAGE_KEYS.watchlistAt, storage);
  const pulledFor = useRef<string | undefined>(undefined);
  const synced = useRef(0);

  useEffect(() => {
    if (!unlockedAs || !client || pulledFor.current === unlockedAs) return;
    pulledFor.current = unlockedAs;
    void pullWatchlist(client, faceId)
      .then((remote) => {
        const local = localWatchlist();
        if (remote && remote.at > local.at) {
          synced.current = remote.at;
          adoptWatchlist(remote);
        } else if (local.at > (remote?.at ?? 0)) {
          synced.current = local.at;
          return pushWatchlist(client, faceId, local);
        }
        return undefined;
      })
      // Offline or the api refused: this phone's list stands; the next unlock tries again.
      .catch(() => {
        pulledFor.current = undefined;
      });
  }, [unlockedAs, client, faceId]);

  useEffect(() => {
    if (!unlockedAs || !client || pulledFor.current !== unlockedAs || changedAt === undefined) return;
    if (changedAt <= synced.current) return;
    const timer = setTimeout(() => {
      const local = localWatchlist();
      synced.current = local.at;
      void pushWatchlist(client, faceId, local).catch(() => undefined);
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [changedAt, unlockedAs, client, faceId]);

  return null;
}
