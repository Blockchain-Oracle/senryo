import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/settings/settings-screen";

export const metadata: Metadata = { title: "Settings" };

/** `?section=` is read on the client; the static export pre-renders the list. */
export default function AccountPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
