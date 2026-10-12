import { Stack, useLocalSearchParams } from "expo-router";
import { EmptyState } from "~/components/kit/states";
import { RideReceipt } from "~/features/receipts/RideReceipt";

const RIDE_ID = /^\d{1,20}$/;

/** A ride's receipt (R5.11): `/calls/rides/<rideId>` from the positions, a result or a share link. */
export default function RidePage() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const valid = typeof rideId === "string" && RIDE_ID.test(rideId);
  return (
    <>
      <Stack.Screen options={{ title: "Ride" }} />
      {valid ? <RideReceipt rideId={BigInt(rideId)} /> : <EmptyState why="No such ride" detail="Check the link." />}
    </>
  );
}
