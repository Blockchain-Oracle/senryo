/**
 * The event card's scoreboard on the phone (R7.9, research 10 §5; the web's `score-board.tsx`): both crests facing
 * each other with their names, the score between them and the game's state — a LIVE chip while it plays — and each
 * team's colour as a band down its edge of the card (`TeamBands`).
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { withAlpha } from "~/theme/palette";

export interface BoardSide {
  crest: ReactNode;
  name: string;
  score: number | null;
  color: string | null;
}

export interface ScoreBoard {
  home: BoardSide;
  away: BoardSide;
  state: string;
  live: boolean;
}

/** The bands down the card's edges (research 10 §5: 6 pt) and the faint wash behind each half. */
const BAND = 6;
const WASH = 0.08;

export function BoardRow({ board }: { board: ScoreBoard }) {
  const { color } = useTheme();
  const scored = board.home.score !== null && board.away.score !== null;
  return (
    <View style={styles.row}>
      <Side side={board.home} />
      <View style={styles.middle}>
        <Text style={[TYPE.sectionTitle, styles.score, { color: color.ink }]}>
          {scored ? `${board.home.score} – ${board.away.score}` : "vs"}
        </Text>
        <View style={[styles.state, board.live ? { backgroundColor: color.downSurface } : null]}>
          {board.live ? <View style={[styles.dot, { backgroundColor: color.down }]} /> : null}
          <Text style={[TYPE.micro, { color: board.live ? color.down : color.text3 }]}>{board.state}</Text>
        </View>
      </View>
      <Side side={board.away} />
    </View>
  );
}

function Side({ side }: { side: BoardSide }) {
  const { color } = useTheme();
  return (
    <View style={styles.side}>
      {side.crest}
      <Text numberOfLines={1} style={[TYPE.caption, styles.name, { color: color.ink }]}>
        {side.name}
      </Text>
    </View>
  );
}

/** Each team's colour down its edge with a faint wash, behind the card's content. */
export function TeamBands({ board }: { board: ScoreBoard | undefined }) {
  if (!board) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {board.home.color ? (
        <>
          <View style={[styles.wash, styles.washLeft, { backgroundColor: withAlpha(board.home.color, WASH) }]} />
          <View style={[styles.band, styles.left, { backgroundColor: board.home.color }]} />
        </>
      ) : null}
      {board.away.color ? (
        <>
          <View style={[styles.wash, styles.washRight, { backgroundColor: withAlpha(board.away.color, WASH) }]} />
          <View style={[styles.band, styles.right, { backgroundColor: board.away.color }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  side: { flex: 1, alignItems: "center", gap: SPACE.xxs },
  name: { fontWeight: "600", textAlign: "center" },
  middle: { alignItems: "center", gap: SPACE.xxs },
  score: { fontVariant: ["tabular-nums"] },
  state: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.xs,
    borderRadius: RADIUS.xs,
  },
  dot: { width: SPACE.xs + SPACE.xxs, height: SPACE.xs + SPACE.xxs, borderRadius: SPACE.xs },
  band: { position: "absolute", top: 0, bottom: 0, width: BAND },
  left: { left: 0 },
  right: { right: 0 },
  wash: { position: "absolute", top: 0, height: "45%", width: "50%" },
  washLeft: { left: 0, borderBottomRightRadius: RADIUS.xl },
  washRight: { right: 0, borderBottomLeftRadius: RADIUS.xl },
});
