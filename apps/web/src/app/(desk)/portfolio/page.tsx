import type { Metadata } from "next";
import { PortfolioScreen } from "@/components/screens/portfolio-screen";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return <PortfolioScreen />;
}
