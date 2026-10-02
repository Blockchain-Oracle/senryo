import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupScreen } from "@/components/setup/setup-screen";

export const metadata: Metadata = { title: "Setup" };

/** `?next=` is read on the client; the static export pre-renders the shell. */
export default function SetupPage() {
  return (
    <Suspense>
      <SetupScreen />
    </Suspense>
  );
}
