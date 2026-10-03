import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicHeader } from "@/components/public/public-header";
import { StatsScreen } from "@/components/stats/stats-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicDataProvider } from "@/lib/stats/provider";

export const metadata: Metadata = {
  title: "Stats",
  description: "Senryo's accounts, trades, traded notional and pool value per network, live from the public indexer.",
};

/**
 * /stats — public traction (D-022), outside the app shell: no account, no chain socket. `useSearchParams` reads
 * `?chainId=` on the client; the static export pre-renders the header and a skeleton.
 */
export default function StatsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <PublicHeader current="stats" />
      <PublicDataProvider>
        <Suspense fallback={<Skeleton className="mt-6 h-96 w-full" />}>
          <StatsScreen />
        </Suspense>
      </PublicDataProvider>
    </main>
  );
}
