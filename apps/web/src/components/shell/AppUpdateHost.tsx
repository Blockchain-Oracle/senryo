"use client";

import { useAppUpdate } from "@/lib/use-app-update";

/** Mounts the new-version check once, in the app shell (a server component). */
export function AppUpdateHost() {
  useAppUpdate();
  return null;
}
