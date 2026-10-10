import type { Metadata } from "next";
import { WarmUpScreen } from "@/features/games/WarmUpScreen";

export const metadata: Metadata = { title: "Warm-up" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Warm-up</h1>
      <WarmUpScreen />
    </div>
  );
}
