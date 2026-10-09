"use client";
/** Text that changes per tick, painted straight into the DOM from a live value (no React render per tick, D-272). */
import { useEffect, useRef } from "react";
import type { LiveValue } from "@/lib/terminal/live-value";

export function LiveText<T>({
  value,
  format,
  className,
}: {
  value: LiveValue<T>;
  format?: (v: T) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = (v: T) => {
      el.textContent = formatRef.current ? formatRef.current(v) : String(v);
    };
    paint(value.get());
    return value.subscribe(paint);
  }, [value]);
  return <span ref={ref} className={className} />;
}
