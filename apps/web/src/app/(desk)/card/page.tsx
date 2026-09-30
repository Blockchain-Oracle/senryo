import type { Metadata } from "next";
import { CardScreen } from "@/components/screens/card-screen";

export const metadata: Metadata = { title: "Card" };

export default function CardPage() {
  return <CardScreen />;
}
