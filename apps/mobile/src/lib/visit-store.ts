/**
 * Where the phone keeps visits (R6, D-337, `@senryo/search` `visits.ts`): MMKV — search's Recents and frecency, and
 * the market sheet's recent markets.
 */
import { configureVisitStore } from "@senryo/search";
import { storage } from "./storage";

configureVisitStore({
  read: (key) => storage.getString(key),
  write: (key, value) => storage.set(key, value),
  remove: (key) => {
    storage.remove(key);
  },
});
