/**
 * The Games hub on the phone (S8.8, D-295; the web's `GamesHub`; R7.7): each game as a card that shows the game
 * itself (`GameArt`), with whose money is at risk and an explicit Play, then the head-to-head and multi-call places.
 */
import { GAMES } from "@senryo/config";
import { ids, marketId, type PixelMarkName } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/native";
import { type Href, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Panel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { pixelColors } from "~/theme/pixel-colors";
import { GameArt } from "./GameArt";

const ART = 24;
const PLAY_EDGE = 3;
/** Each game's key art (R2.8; the web hub's): the pixel marks it plays with. */
const GAME_ART: Readonly<Record<string, readonly PixelMarkName[]>> = {
  lucky: ["coin"],
  "warm-up": ["bull", "bear"],
  "line-rider": ["bull"],
  "candle-hop": ["bear"],
};
const LEAGUE_KEYS = ["nhl", "mlb", "epl"] as const;

const MORE = [
  { route: "/duel", title: "Duel", line: "The same three cards · the better total takes the pot", art: "markets" },
  { route: "/parlay", title: "Parlay", line: "Two to four calls that must all come true", art: "markets" },
  { route: "/events", title: "Events", line: "Yes or No on real games", art: "leagues" },
] as const;

export function GamesScreen() {
  const { color } = useTheme();
  const pixels = pixelColors(color);
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
      {GAMES.map((g) => (
        <Pressable key={g.key} accessibilityRole="link" onPress={() => go(g.route)}>
          <Panel style={styles.card}>
            <GameArt game={g.key} />
            <View style={styles.cardFoot}>
              <View style={styles.cardText}>
                <View style={styles.art}>
                  {(GAME_ART[g.key] ?? []).map((n) => (
                    <PixelMark key={n} name={n} size={ART} colors={pixels} />
                  ))}
                  <Text style={[TYPE.sectionTitle, { color: color.ink }]}>{g.title}</Text>
                </View>
                <Text style={[TYPE.body, { color: color.inkMuted }]}>{g.line}</Text>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>{g.stakes}</Text>
              </View>
              <View style={[styles.play, { backgroundColor: color.upFill, borderBottomColor: color.upFillEdge }]}>
                <Text style={[TYPE.buttonLabel, { color: color.onDirectionFill }]}>Play</Text>
              </View>
            </View>
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
          {m.art === "markets" ? (
            <EntityMark id={marketId("MAJORS")} size={SIZE.markToken} decorative />
          ) : (
            <View style={styles.art}>
              {LEAGUE_KEYS.map((l) => (
                <EntityMark key={l} id={ids.league(l)} size={SIZE.markInline} decorative />
              ))}
            </View>
          )}
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
  card: { gap: SPACE.md, padding: SPACE.md },
  cardFoot: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md },
  cardText: { flex: 1, gap: SPACE.xxs },
  play: {
    height: SIZE.touch,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.sm,
    borderBottomWidth: PLAY_EDGE,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  row: {
    minHeight: SIZE.rowMinHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  art: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs, paddingBottom: SPACE.xs },
});
