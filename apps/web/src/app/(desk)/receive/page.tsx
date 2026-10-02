import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceiveScreen } from "@/components/money/receive-screen";

export const metadata: Metadata = { title: "Receive" };

/** `?from=exchange` is read on the client; the static export pre-renders the shell. */
export default function ReceivePage() {
  return (
    <Suspense>
      <ReceiveScreen />
    </Suspense>
  );
}
