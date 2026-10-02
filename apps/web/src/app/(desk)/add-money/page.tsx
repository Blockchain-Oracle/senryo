import type { Metadata } from "next";
import { AddMoneyScreen } from "@/components/money/add-money-screen";

export const metadata: Metadata = { title: "Add money" };

export default function AddMoneyPage() {
  return <AddMoneyScreen />;
}
