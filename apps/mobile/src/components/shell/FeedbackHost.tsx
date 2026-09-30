import { useEffect } from "react";
import { prepareSounds, releaseSounds } from "~/feedback/sound";

/** Headless: preloads the UI sound pool once for the app's lifetime (first-play latency). */
export function FeedbackHost() {
  useEffect(() => {
    void prepareSounds();
    return releaseSounds;
  }, []);
  return null;
}
