import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { UPDATE_AWAY_MS } from "~/lib/constants/time";
import { notify } from "~/lib/notify";

/**
 * A new version lands without two cold starts (13 Oct: the owner's iPhone stayed on the first fix for hours —
 * expo-updates checks only at launch and applies at the next one, and the app mostly resumes from the background).
 * Coming back to the app checks and downloads; once a version is downloaded (at launch or on a return), one toast offers
 * Restart; back after a long time away, it applies on its own.
 */
export function UpdateHost() {
  const { isUpdatePending } = Updates.useUpdates();
  const pending = useRef(isUpdatePending);
  pending.current = isUpdatePending;

  useEffect(() => {
    if (!isUpdatePending) return;
    notify({
      id: "app-update",
      title: "New version ready",
      action: { label: "Restart", onClick: () => void Updates.reloadAsync() },
    });
  }, [isUpdatePending]);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let left = 0;
    let checking = false;
    const check = async () => {
      if (checking || pending.current) return;
      checking = true;
      try {
        const found = await Updates.checkForUpdateAsync();
        if (found.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline, or the server said no: the next return tries again.
      } finally {
        checking = false;
      }
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") left = Date.now();
      if (state !== "active") return;
      if (pending.current && left > 0 && Date.now() - left >= UPDATE_AWAY_MS) void Updates.reloadAsync();
      else void check();
    });
    return () => sub.remove();
  }, []);

  return null;
}
