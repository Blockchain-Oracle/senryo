import { Stack, useLocalSearchParams } from "expo-router";
import { EventDetailScreen } from "~/features/events/EventDetailScreen";

/** One question: the call, the rule and each committee member's signed answer (a payout push opens here). */
export default function Event() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: "Event", headerShown: true, headerBackTitle: "Back" }} />
      <EventDetailScreen eventId={id ?? ""} />
    </>
  );
}
