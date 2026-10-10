import type { Metadata } from "next";
import { GamesHub } from "@/features/games/GamesHub";

export const metadata: Metadata = { title: "Games" };

export default function GamesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Games</h1>
      <GamesHub />
    </div>
  );
}
