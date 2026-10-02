import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { LpScreen, PoolMark } from "~/features/lp/LpScreen";
import { InfoSheet, PoolDisclosures } from "~/features/lp/PoolDisclosures";
import { LockedBar } from "~/features/trade/SideBar";
import { useReadOnlyNetwork } from "~/lib/network";
import { SPACE } from "~/theme";

/**
 * `/lp` — the Senryo pool (flow book D1/D2). On Mainnet before the deploy it is the same page with the slide locked:
 * "Opens at launch".
 */
export default function LiquidityPoolScreen() {
  const readOnly = useReadOnlyNetwork();
  return (
    <>
      <Stack.Screen options={{ title: "Pool" }} />
      {readOnly ? <LockedPool /> : <LpScreen />}
    </>
  );
}

function LockedPool() {
  const [info, setInfo] = useState<{ title: string; body: string } | undefined>();
  return (
    <View style={styles.fill}>
      <Screen contentStyle={styles.stack}>
        <PoolMark />
        <PoolDisclosures onInfo={setInfo} />
      </Screen>
      <LockedBar word="Opens at launch" />
      <InfoSheet info={info} onClose={() => setInfo(undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stack: { gap: SPACE.xl },
});
