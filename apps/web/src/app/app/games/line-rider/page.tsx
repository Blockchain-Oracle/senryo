import type { Metadata } from "next";
import { ArcadeScreen } from "@/features/games/arcade/ArcadeScreen";

export const metadata: Metadata = { title: "Line Rider" };

const MOVES = [
  { keys: "Hold · Space", text: "Crouch into the line: more grip, more speed, and a charged hop." },
  { keys: "Let go", text: "Hop. The longer you held, the higher. Clear the gaps in the chart." },
  { keys: "Left · right half · ← →", text: "Lean in the air. Land flat to build the combo; a full flip pays 500." },
] as const;

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-page-title">Line Rider</h1>
        <p className="text-body text-text-2">Ride the real chart: a day of BTC, ETH or SOL, one minute at a time.</p>
      </div>
      <ArcadeScreen
        game="line-rider"
        title="Line Rider"
        hint="Hold to crouch · let go to hop · lean with the left or right half (← →)"
        moves={MOVES}
      />
    </div>
  );
}
