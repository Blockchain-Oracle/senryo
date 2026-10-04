import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/** Pause public discovery polling when its page sits behind another route. Uses the shell's existing router. */
export function useFocused() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
