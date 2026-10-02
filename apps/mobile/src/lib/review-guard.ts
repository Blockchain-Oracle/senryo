import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
/** Changes, unmounts and background interruptions invalidate the original asynchronous review. */
export function useReviewGuard(intent: string) {
  const [generation, setGeneration] = useState(0);
  const live = useRef({ intent, mounted: true, generation });
  live.current.intent = intent;
  useEffect(() => {
    live.current.mounted = true;
    const listener = AppState.addEventListener("change", (state) => {
      // Authentication can briefly make iOS inactive. Leaving the app ends this review.
      if (state === "background") {
        live.current.generation += 1;
        setGeneration(live.current.generation);
      }
    });
    return () => {
      live.current.mounted = false;
      listener.remove();
    };
  }, []);
  return () => {
    if (!live.current.mounted || live.current.intent !== intent || live.current.generation !== generation)
      throw new Error("Details or app state changed. Review again.");
  };
}
