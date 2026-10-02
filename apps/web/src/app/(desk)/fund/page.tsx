import type { Metadata } from "next";
import { FundScreen } from "@/components/screens/fund-screen";
import { Column } from "@/components/shell/column";

export const metadata: Metadata = { title: "Fund" };

export default function FundPage() {
  return (
    <Column>
      <FundScreen />
    </Column>
  );
}
