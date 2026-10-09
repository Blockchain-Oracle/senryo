import type { Metadata } from "next";
import { ParlayScreen } from "@/features/parlay/ParlayScreen";

export const metadata: Metadata = { title: "Parlay" };

export default function ParlayPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Parlay</h1>
      <ParlayScreen />
    </div>
  );
}
