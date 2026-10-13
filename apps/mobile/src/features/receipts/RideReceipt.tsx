/**
 * One ride's receipt on the phone (R5.11, D-331; the web's `RideReceipt`): its slip — the realised result and its
 * stamp, margin, leverage, size, entry and exit, knock-out and cap, fees, what came back, and the transaction that
 * ended it — shared with PnL · ROI · Both (R5.21), open or ended. A live ride opens the terminal.
 */
import { rideFigure, rideFilm, rideKey, rideLink, rideSlip } from "@senryo/calls";
import { useRide } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { ReplayVideo } from "~/features/replay/ReplayVideo";
import { fire } from "~/feedback/fire";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE } from "~/theme";
import { LiveShareSlip, ShareSlip } from "./ShareSlip";

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
  const side = r.isLong ? "Up" : "Down";
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        {slip.live ? (
          <LiveShareSlip slip={slip} entryKey={rideKey(r.rideId)} side={side} />
        ) : (
          <ShareSlip slip={slip} figure={rideFigure(r)} side={side} />
        )}
        {slip.live ? null : (
          <ReplayVideo
            chainId={network.chainId}
            bookKey={rideKey(r.rideId)}
            url={slip.url}
            build={(episode) => rideFilm(r, episode, { practice: network.modeLabel === "Practice" })}
          />
        )}
        {slip.live ? (
          <Button
            label="Watch it live"
            variant="secondary"
            onPress={() => {
              fire("tick");
              setSymbol(r.symbol);
              router.navigate("/trade");
            }}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  hero: { gap: SPACE.md },
});
