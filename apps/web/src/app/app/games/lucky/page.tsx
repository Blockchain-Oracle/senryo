import type { Metadata } from "next";
import { LuckyScreen } from "@/features/games/LuckyScreen";

export const metadata: Metadata = { title: "Lucky" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Lucky</h1>
      <LuckyScreen />
    </div>
  );
}
