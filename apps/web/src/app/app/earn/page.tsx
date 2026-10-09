import type { Metadata } from "next";
import { EarnScreen } from "@/features/earn/EarnScreen";

export const metadata: Metadata = { title: "Earn" };

export default function EarnPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Earn</h1>
      <EarnScreen />
    </div>
  );
}
