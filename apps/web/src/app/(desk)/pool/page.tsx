import type { Metadata } from "next";
import { PoolScreen } from "@/components/pool/pool-screen";

export const metadata: Metadata = { title: "Pool" };

export default function PoolPage() {
  return <PoolScreen />;
}
