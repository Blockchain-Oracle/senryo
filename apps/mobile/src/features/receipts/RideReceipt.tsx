/**
 * One ride's receipt on the phone (R5.11, D-331; the web's `RideReceipt`): its slip — the realised result and its
 * stamp, margin, leverage, size, entry and exit, knock-out and cap, fees, what came back, and the transaction that
 * ended it — shared or saved as one image. A live ride opens the terminal.
 */
import { rideLink, rideSlip } from "@senryo/calls";
import { useRide } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE } from "~/theme";
import { SlipShare } from "./SlipShare";
import { TradeSlip } from "./TradeSlip";

export function RideReceipt({ rideId }: { rideId: bigint }) {
  const network = useNetwork();
  const bottom = useDockInset();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const ride = useRide(rideId);
  if (!("value" in ride)) {
    if (ride.status !== "failed") return <LoadingState />;
    return <EmptyState why="This ride isn't here" detail="It appears a few seconds after it opens." />;
  }
  const r = ride.value.ride;
  const slip = rideSlip(r, {
    chainId: network.chainId,
    practice: network.modeLabel === "Practice",
    url: rideLink(r.rideId, network.chainId),
  });
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        <TradeSlip slip={slip} />
        {slip.live ? (
          <Button
            label="Watch it live"
            onPress={() => {
              fire("tick");
              setSymbol(r.symbol);
              router.navigate("/trade");
            }}
          />
        ) : (
          <SlipShare slip={slip} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  hero: { gap: SPACE.md },
});
