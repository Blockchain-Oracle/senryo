import type { Metadata } from "next";
import { Suspense } from "react";
import { MoveFlow } from "@/components/money/move-flow";

export const metadata: Metadata = { title: "Send" };

/** `?to=` / `?asset=` are read on the client; the static export pre-renders the shell. */
export default function SendPage() {
  return (
    <Suspense>
      <MoveFlow kind="send" />
    </Suspense>
  );
}
