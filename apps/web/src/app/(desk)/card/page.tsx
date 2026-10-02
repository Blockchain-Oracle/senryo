import type { Metadata } from "next";
import { CardScreen } from "@/components/card/card-screen";

export const metadata: Metadata = { title: "Card" };

export default function CardPage() {
  return <CardScreen />;
}
