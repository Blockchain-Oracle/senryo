import type { Metadata } from "next";
import { DuelScreen } from "@/features/duel/DuelScreen";

export const metadata: Metadata = { title: "Duel" };

export default function DuelPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Duel</h1>
      <DuelScreen />
    </div>
  );
}
