import type { Metadata } from "next";
import { FundScreen } from "@/components/screens/fund-screen";

export const metadata: Metadata = { title: "Fund" };

export default function FundPage() {
  return <FundScreen />;
}
