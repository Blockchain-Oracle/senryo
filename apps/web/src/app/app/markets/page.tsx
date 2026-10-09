import type { Metadata } from "next";
import { MarketList } from "@/features/markets/MarketList";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Markets</h1>
      <MarketList />
    </div>
  );
}
