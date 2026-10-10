/**
 * The Games hub on the phone (S8.8, D-295; the web's `GamesHub`): each game with whose money is at risk, then the
 * head-to-head and multi-call places with their own screens. Lists the games that have a phone screen.
 */
import { GAMES } from "@senryo/config";
import { type Href, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The phone screens that exist so far (the rest arrive with their stage). */
const ON_PHONE = new Set(["lucky"]);
const MORE = [
  { route: "/duel", title: "Duel", line: "The same three cards · the better total takes the pot" },
  { route: "/parlay", title: "Parlay", line: "Two to four calls that must all come true" },
  { route: "/events", title: "Events", line: "Yes or No on real games" },
] as const;

export function GamesScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const go = (route: string) => {
    fire("tick");
    router.push(route as Href);
  };
  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      {GAMES.filter((g) => ON_PHONE.has(g.key)).map((g) => (
        <Pressable key={g.key} accessibilityRole="link" onPress={() => go(g.route)}>
          <Panel style={styles.card}>
            <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{g.title}</Text>
            <Text style={[TYPE.body, { color: color.inkMuted }]}>{g.line}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{g.stakes}</Text>
          </Panel>
        </Pressable>
      ))}
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Head to head and more
      </Text>
      {MORE.map((m) => (
        <Pressable
          key={m.route}
          accessibilityRole="link"
          onPress={() => go(m.route)}
          style={[styles.row, { borderBottomColor: color.hairline }]}
        >
          <View style={styles.flex}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]}>{m.title}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{m.line}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.md },
  card: { gap: SPACE.xxs, padding: SPACE.md },
  flex: { flex: 1 },
  row: { minHeight: SIZE.rowMinHeight, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth },
});
