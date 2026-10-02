import type { Metadata } from "next";
import { CardScreen } from "@/components/screens/card-screen";
import { Column } from "@/components/shell/column";

export const metadata: Metadata = { title: "Card" };

export default function CardPage() {
  return (
    <Column>
      <CardScreen />
    </Column>
  );
}
