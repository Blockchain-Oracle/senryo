import { ENGINE_MARKETS, engineMarket } from "@senryo/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradeScreen } from "@/components/screens/trade/trade-screen";

type Params = { market: string };

export const dynamicParams = false;

/** One page per engine market (the static export pre-renders each); whether it trades here is read on the client. */
export function generateStaticParams(): Params[] {
  return ENGINE_MARKETS.map((m) => ({ market: m.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { market } = await params;
  return { title: `${market.toUpperCase()} · Trade` };
}

export default async function TradePage({ params }: { params: Promise<Params> }) {
  const { market } = await params;
  const found = engineMarket(market.toUpperCase());
  if (!found) notFound();
  return <TradeScreen marketId={found.id} />;
}
