import { marketsOn } from "@senryo/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TerminalScreen } from "@/features/terminal/TerminalScreen";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";

const MARKETS = marketsOn(ACTIVE_NETWORK.chainId);
const marketOf = (slug: string) => MARKETS.find((m) => m.symbol.toLowerCase() === slug);

/** One terminal per market in the catalogue (`@senryo/config`), exported statically; others are a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.map((m) => ({ symbol: m.symbol.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const market = marketOf((await params).symbol);
  return { title: market ? `${market.symbol} · ${market.name}` : "Trade" };
}

export default async function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
  const market = marketOf((await params).symbol);
  if (!market) notFound();
  return <TerminalScreen symbol={market.symbol} />;
}
