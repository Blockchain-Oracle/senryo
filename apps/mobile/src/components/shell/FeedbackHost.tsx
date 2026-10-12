import { useEffect } from "react";
import { releaseCues } from "~/feedback/cues";
import { applyVolumes } from "~/feedback/fire";
import { releaseMusic } from "~/feedback/music";
import { prepareSounds, releaseSounds } from "~/feedback/sound";

/**
 * Holds the sound players for the app's life. Call outcomes fire their own feedback from the user's live events (a
 * fill, a result, a payout — S5); a historical receipt never replays it.
 */
export function FeedbackHost() {
  useEffect(() => {
    void prepareSounds();
    applyVolumes();
    return () => {
      releaseSounds();
      releaseCues();
      releaseMusic();
    };
  }, []);
  return null;
}
