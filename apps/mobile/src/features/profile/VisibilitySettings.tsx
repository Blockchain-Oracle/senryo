/**
 * Who can see the profile, per network (A7, D-174; f-social "Visibility per mode"): one address on both networks, so
 * each network gets its own two switches — List my profile, Share my trades — as title-only rows under the network's
 * name, with the one thing to know behind the heading's ⓘ (same address, onchain activity is public). Privacy first,
 * as the API has it: trades are only shared from a listed profile, so turning a listing off turns its trades off.
 */

import { SHARED_ADDRESS, type Visibility } from "@senryo/calls";
import { StyleSheet, Switch, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { InfoTip } from "~/features/setup/InfoTip";
import { fire } from "~/feedback/fire";
import { SPACE, TYPE, useTheme } from "~/theme";

export type { Visibility } from "@senryo/calls";

export const visibilityOf = (v: Visibility): Visibility => ({
  listedPractice: v.listedPractice,
  listedMainnet: v.listedMainnet,
  publicTradesPractice: v.publicTradesPractice,
  publicTradesMainnet: v.publicTradesMainnet,
});

const NETWORKS = [
  { mode: "Practice", listed: "listedPractice", trades: "publicTradesPractice" },
  { mode: "Real", listed: "listedMainnet", trades: "publicTradesMainnet" },
] as const;

export function VisibilitySettings({ value, onChange }: { value: Visibility; onChange: (next: Visibility) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
          Who can see you
        </Text>
        <InfoTip title={SHARED_ADDRESS.title} body={SHARED_ADDRESS.body} />
      </View>
      {NETWORKS.map((network) => {
        const tone = network.mode === "Practice" ? color.practice : color.mainnet;
        const listed = value[network.listed];
        const switchColors = { trackColor: { true: tone, false: color.muted }, thumbColor: color.foreground };
        return (
          <View key={network.mode} style={styles.network}>
            <Text style={[TYPE.modeLabel, { color: tone }]}>{network.mode}</Text>
            <Panel>
              <ListRow
                title="List my profile"
                trailing={
                  <Switch
                    {...switchColors}
                    value={listed}
                    onValueChange={(on) => {
                      fire("tick");
                      onChange({ ...value, [network.listed]: on, ...(on ? {} : { [network.trades]: false }) });
                    }}
                    accessibilityLabel={`List my profile in ${network.mode}`}
                  />
                }
              />
              <ListRow
                title="Share my trades"
                trailing={
                  <Switch
                    {...switchColors}
                    value={listed && value[network.trades]}
                    disabled={!listed}
                    onValueChange={(on) => {
                      fire("tick");
                      onChange({ ...value, [network.trades]: on });
                    }}
                    accessibilityLabel={`Show my calls in ${network.mode}`}
                  />
                }
              />
            </Panel>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  heading: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  network: { gap: SPACE.sm },
});
