import type { Metadata } from "next";
import { Suspense } from "react";
import { MoveFlow } from "@/components/money/move-flow";

export const metadata: Metadata = { title: "Withdraw" };

/** `?to=` / `?asset=` are read on the client; the static export pre-renders the shell. */
export default function WithdrawPage() {
  return (
    <Suspense>
      <MoveFlow kind="withdraw" />
    </Suspense>
  );
}
