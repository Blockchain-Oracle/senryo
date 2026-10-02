import type { Metadata } from "next";
import { Suspense } from "react";
import { PositionScreen } from "@/components/trade/position-screen";

export const metadata: Metadata = { title: "Position" };

/** `?market=XAU` is read on the client; the static export pre-renders the shell. */
export default function PositionPage() {
  return (
    <Suspense>
      <PositionScreen />
    </Suspense>
  );
}
