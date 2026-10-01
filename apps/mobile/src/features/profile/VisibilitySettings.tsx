/**
 * Who can see the profile, per network (D-174, direction §6: Practice and Mainnet are separate datasets). The account
 * has one address on both networks, so each network gets its own two switches — list the profile, share its trades —
 * each with one line on what it exposes, under the network's own colour (practice violet, mainnet blue). Privacy
 * first, as the API has it: trades can only be shared from a listed profile, so turning a listing off turns that
 * network's trades off with it.
 */
import { StyleSheet, Switch, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

export interface Visibility {
  listedPractice: boolean;
  listedMainnet: boolean;
  publicTradesPractice: boolean;
  publicTradesMainnet: boolean;
}

export const visibilityOf = (v: Visibility): Visibility => ({
  listedPractice: v.listedPractice,
  listedMainnet: v.listedMainnet,
  publicTradesPractice: v.publicTradesPractice,
  publicTradesMainnet: v.publicTradesMainnet,
});

const NETWORKS = [
  {
    mode: "Practice",
    money: "paper money",
    listed: "listedPractice",
    trades: "publicTradesPractice",
    listedDetail: "Your username, name and bio can be found, followed and ranked in Practice.",
    tradesDetail: "Your paper-money trades appear in the feed and on your profile.",
  },
  {
    mode: "Mainnet",
    money: "real money",
    listed: "listedMainnet",
    trades: "publicTradesMainnet",
    listedDetail: "The same username, name and bio appear beside your real-money results.",
    tradesDetail: "Your real-money trades appear in the feed and on your profile.",
  },
] as const;

export function VisibilitySettings({ value, onChange }: { value: Visibility; onChange: (next: Visibility) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
          Who can see you
        </Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          Each network is its own choice. A profile that isn’t listed can’t be looked up, followed or ranked there.
        </Text>
      </View>
      {NETWORKS.map((network) => {
        const tone = network.mode === "Practice" ? color.practice : color.mainnet;
        const listed = value[network.listed];
        const switchColors = { trackColor: { true: tone, false: color.muted }, thumbColor: color.foreground };
        return (
          <View key={network.mode} style={styles.network}>
            <View style={styles.mode}>
              <View style={[styles.dot, { backgroundColor: tone }]} />
              <Text style={[TYPE.modeLabel, { color: tone }]}>
                {network.mode} · {network.money}
              </Text>
            </View>
            <Panel>
              <ListRow
                title={`List my profile in ${network.mode}`}
                detail={network.listedDetail}
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
                title={`Share my trades in ${network.mode}`}
                detail={listed ? network.tradesDetail : `Needs your profile listed in ${network.mode}.`}
                trailing={
                  <Switch
                    {...switchColors}
                    value={listed && value[network.trades]}
                    disabled={!listed}
                    onValueChange={(on) => {
                      fire("tick");
                      onChange({ ...value, [network.trades]: on });
                    }}
                    accessibilityLabel={`Share my trades in ${network.mode}`}
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

const DOT = SPACE.sm;

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  heading: { gap: SPACE.xs },
  network: { gap: SPACE.sm },
  mode: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  dot: { width: DOT, height: DOT, borderRadius: RADIUS.pill },
});
