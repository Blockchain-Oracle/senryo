import type { Metadata } from "next";
import { AccountStrip } from "@/components/auth/account-strip";
import { PortfolioScreen } from "@/components/screens/portfolio-screen";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <AccountStrip />
      <PortfolioScreen />
    </>
  );
}
