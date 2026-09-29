"use client";
import { useEffect, useState } from "react";
export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setValue(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return value;
}
