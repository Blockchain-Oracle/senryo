import { Stack, useLocalSearchParams } from "expo-router";
import { EmptyState } from "~/components/kit/states";
import { CallReceipt } from "~/features/calls/CallReceipt";

const TICKET_ID = /^\d{1,20}$/;

/** A call's receipt (S5.11): `/calls/<ticketId>` from Calls, Home, a result push or a share link. */
export default function CallPage() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const valid = typeof ticketId === "string" && TICKET_ID.test(ticketId);
  return (
    <>
      <Stack.Screen options={{ title: "Call" }} />
      {valid ? <CallReceipt ticketId={BigInt(ticketId)} /> : <EmptyState why="No such call" detail="Check the link." />}
    </>
  );
}
