import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/** Whether this screen is the focused route: pause polling while it sits behind another one. */
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
