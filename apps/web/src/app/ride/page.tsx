import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { PublicRide } from "@/features/receipts/PublicRide";

export const metadata: Metadata = {
  title: "A ride on Senryo",
  description: "A ride on live prices: its result, its entry and exit, and the transaction that ended it.",
};

/** A shared ride's public receipt (the slip's link). */
export default function RidePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 pb-16">
      <PublicHeader />
      {/* One h1 per page (R2.18): the slip's title below is its h2. */}
      <h1 className="sr-only">A ride on Senryo</h1>
      <PublicRide />
    </main>
  );
}
