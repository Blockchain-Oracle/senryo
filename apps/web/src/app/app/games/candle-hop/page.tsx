import type { Metadata } from "next";
import { ArcadeScreen } from "@/features/games/arcade/ArcadeScreen";

export const metadata: Metadata = { title: "Candle Hop" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Candle Hop</h1>
      <ArcadeScreen
        game="candle-hop"
        title="Candle Hop"
        how="Tap, click or press Space to hop through the gaps between the candles"
      />
    </div>
  );
}
