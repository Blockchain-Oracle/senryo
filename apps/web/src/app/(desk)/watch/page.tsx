import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchScreen } from "@/components/screens/watch-screen";
import { Column } from "@/components/shell/column";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Watch" };

/** `useSearchParams` reads `?address=` on the client; the static export pre-renders the shell (Next docs). */
export default function WatchPage() {
  return (
    <Column>
      <Suspense fallback={<Skeleton className="mt-6 h-24" />}>
        <WatchScreen />
      </Suspense>
    </Column>
  );
}
