import type { Metadata } from "next";
import { ArcadeScreen } from "@/features/games/arcade/ArcadeScreen";

export const metadata: Metadata = { title: "Candle Hop" };

const MOVES = [
  { keys: "Tap · Space", text: "Hop up. Let go and you fall." },
  { keys: "Thread the gap", text: "Every candle you pass scores, and the gaps close as you go." },
  { keys: "Don't touch", text: "A wick or a body ends the run." },
] as const;

export default function Page() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Candle Hop</h1>
      <ArcadeScreen game="candle-hop" title="Candle Hop" hint="Tap, click or press Space to hop" moves={MOVES} />
    </div>
  );
}
