import { Stack } from "expo-router";
import { ArcadeScreen } from "~/features/games/arcade/ArcadeScreen";

const MOVES = [
  { keys: "Hold", text: "Crouch into the line: more grip, more speed, and a charged hop." },
  { keys: "Let go", text: "Hop. The longer you held, the higher. Clear the gaps in the chart." },
  { keys: "Left · right half", text: "Lean in the air. Land flat to build the combo; a full flip pays 500." },
] as const;

/** Line Rider: a sled riding the real chart (R7.2, R7.6). */
export default function LineRider() {
  return (
    <>
      <Stack.Screen options={{ title: "Line Rider", headerShown: true, headerBackTitle: "Back" }} />
      <ArcadeScreen
        game="line-rider"
        title="Line Rider"
        hint="Hold to crouch · let go to hop · touch the left or right half to lean"
        moves={MOVES}
      />
    </>
  );
}
