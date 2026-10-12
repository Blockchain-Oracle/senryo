"use client";
/**
 * The terminal's tour, mounted once in the shell (R5.15): open on the first terminal visit on this device
 * (`TerminalScreen`) and from Settings; done or skipped, it is remembered as seen. Loaded only when it opens.
 */
import dynamic from "next/dynamic";
import { closeTour, useTourOpen, useTourSeen } from "@/lib/terminal/tour";

const Tutorial = dynamic(() => import("@/features/terminal/Tutorial").then((m) => m.Tutorial), { ssr: false });

export function TourHost() {
  const open = useTourOpen();
  const [, markSeen] = useTourSeen();
  if (!open) return null;
  return (
    <Tutorial
      onDone={() => {
        markSeen();
        closeTour();
      }}
    />
  );
}
