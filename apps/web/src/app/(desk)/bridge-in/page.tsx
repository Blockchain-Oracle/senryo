import type { Metadata } from "next";
import { BridgeInScreen } from "@/components/bridge/bridge-in-screen";

export const metadata: Metadata = { title: "From another chain" };

export default function BridgeInPage() {
  return <BridgeInScreen />;
}
