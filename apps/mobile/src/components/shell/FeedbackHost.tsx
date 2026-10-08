import { useEffect } from "react";
import { prepareSounds, releaseSounds } from "~/feedback/sound";

/**
 * Holds the sound players for the app's life. Call outcomes fire their own feedback from the user's live events (a
 * fill, a result, a payout — S5); a historical receipt never replays it.
 */
export function FeedbackHost() {
  useEffect(() => {
    void prepareSounds();
    return releaseSounds;
  }, []);
  return null;
}
