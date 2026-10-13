/**
 * Where the phone keeps replays (R5.19, `@senryo/calls` `replay.ts`): MMKV, saved when an episode ends and when the
 * app leaves the foreground.
 */
import { configureReplayStore, persistReplays } from "@senryo/calls";
import { AppState } from "react-native";
import { storage } from "./storage";

configureReplayStore({
  read: (key) => storage.getString(key),
  write: (key, value) => storage.set(key, value),
});

AppState.addEventListener("change", (state) => {
  if (state !== "active") persistReplays();
});
