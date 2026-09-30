import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

function Pill({ label, live }: { label: string; live: boolean }) {
  const { color } = useTheme();
  const ink = live ? color.up : color.inkMuted;
  return <Text style={[TYPE.micro, styles.pill, { color: ink, borderColor: ink }]}>{label}</Text>;
}

/** F06 practice ↔ real: practice (testnet) is live; mainnet opens with the mainnet deploy (S8) — said plainly. */
export default function ModeScreen() {
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Practice or real" }} />
      <Panel>
        <ListRow
          first
          title={`Practice · ${ACTIVE_NETWORK.name}`}
          detail="Test dollars with no real value. Labelled PRACTICE on every money surface."
          trailing={<Pill label="ACTIVE" live />}
        />
        <ListRow
          title="Mainnet"
          detail="Real money on Monad. Opens with the mainnet deploy."
          trailing={<Pill label="NOT LIVE" live={false} />}
        />
      </Panel>
      <View style={styles.note}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          Your account is the same on both networks — one passkey, one address; positions stay separate per network.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs },
  note: { paddingHorizontal: SPACE.xs },
});
