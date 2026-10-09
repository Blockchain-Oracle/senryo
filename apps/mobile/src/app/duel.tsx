import { Stack } from "expo-router";
import { DuelScreen } from "~/features/duel/DuelScreen";

/** Duel: the same three cards for both of you; the better total takes the pot (S8.6, D-294). */
export default function Duel() {
  return (
    <>
      <Stack.Screen options={{ title: "Duel", headerShown: true, headerBackTitle: "Back" }} />
      <DuelScreen />
    </>
  );
}
