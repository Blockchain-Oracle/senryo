import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradeScreen } from "@/components/screens/trade/trade-screen";
import { findMarket, MARKET_SLUGS } from "@/lib/sample";

type Params = { market: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return MARKET_SLUGS.map((market) => ({ market }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { market } = await params;
  return { title: `${market.toUpperCase()} · Trade` };
}

export default async function TradePage({ params }: { params: Promise<Params> }) {
  const { market } = await params;
  const found = findMarket(market);
  if (!found) notFound();
  return <TradeScreen market={found} />;
}
