/**
 * One ride's receipt on the phone (R5.11, D-331; the web's `RideReceipt`): its slip — the realised result and its
 * stamp, margin, leverage, size, entry and exit, knock-out and cap, fees, what came back, and the transaction that
 * ended it — with its row of actions (D-352): Replay or Live, Post, Share, Save.
 */
import { rideFigure, rideFilm, rideKey, rideLink, rideSlip, rideSpan } from "@senryo/calls";
import { useRide } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { ActionCircle } from "~/components/kit/ActionCircle";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { ChartLine } from "~/components/kit/symbols";
import { useDockInset } from "~/components/shell/dock-context";
import { ReplayAction } from "~/features/replay/ReplayAction";
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
  const live = (
    <ActionCircle
      icon={ChartLine}
      label="Live"
      primary
      onPress={() => {
        fire("tick");
        setSymbol(r.symbol);
        router.navigate("/trade");
      }}
    />
  );
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + SPACE.xl }]}>
      <View style={styles.hero}>
        {slip.live ? (
          <LiveShareSlip slip={slip} entryKey={rideKey(r.rideId)} side={side} lead={live} />
        ) : (
          <ShareSlip
            slip={slip}
            figure={rideFigure(r)}
            side={side}
            lead={
              <ReplayAction
                chainId={network.chainId}
                bookKey={rideKey(r.rideId)}
                url={slip.url}
                span={rideSpan(r)}
                build={(episode, candles) =>
                  rideFilm(r, episode, { practice: network.modeLabel === "Practice", candles })
                }
              />
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  hero: { gap: SPACE.md },
});
