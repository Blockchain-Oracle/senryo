import type { Metadata } from "next";
import { Suspense } from "react";
import { SwapScreen } from "@/components/swap/swap-screen";

export const metadata: Metadata = { title: "Swap" };

/** `?pay=` is read on the client; the static export pre-renders the shell. */
export default function SwapPage() {
  return (
    <Suspense>
      <SwapScreen />
    </Suspense>
  );
}
