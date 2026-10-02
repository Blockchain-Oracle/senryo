"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** A legacy path in the static export (no server redirects): replace it with its new home on the client. */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${to}${window.location.search}`);
  }, [router, to]);
  return null;
}
