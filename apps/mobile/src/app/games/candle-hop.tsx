import { Stack } from "expo-router";
import { ArcadeScreen } from "~/features/games/arcade/ArcadeScreen";

const MOVES = [
  { keys: "Tap", text: "Hop up. Let go and you fall." },
  { keys: "Thread the gap", text: "Every candle you pass scores, and the gaps close as you go." },
  { keys: "Don't touch", text: "A wick or a body ends the run." },
] as const;

/** Candle Hop: a coin through a day of real candles (R7.3, R7.6). */
export default function CandleHop() {
  return (
    <>
      <Stack.Screen options={{ title: "Candle Hop", headerShown: true, headerBackTitle: "Back" }} />
      <ArcadeScreen game="candle-hop" title="Candle Hop" hint="Tap to hop" moves={MOVES} />
    </>
  );
}
