import { Stack } from "expo-router";
import { EventsScreen } from "~/features/events/EventsScreen";

/** Events: Yes or No on real games, settled by a named committee (S8.7, D-296). */
export default function Events() {
  return (
    <>
      <Stack.Screen options={{ title: "Events", headerShown: true, headerBackTitle: "Back" }} />
      <EventsScreen />
    </>
  );
}
