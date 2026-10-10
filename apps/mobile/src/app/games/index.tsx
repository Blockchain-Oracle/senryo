import { Stack } from "expo-router";
import { GamesScreen } from "~/features/games/GamesScreen";

/** Games: Lucky, Warm-up and the arcade (S8.8, D-295). */
export default function Games() {
  return (
    <>
      <Stack.Screen options={{ title: "Games", headerShown: true, headerBackTitle: "Back" }} />
      <GamesScreen />
    </>
  );
}
