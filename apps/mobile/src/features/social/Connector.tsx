/**
 * Thread connectors (Fomo F15): the quiet line that drops from under an avatar and turns into what hangs off it — a
 * thesis's text in the feed, each reply in a thread. Lines only; they sit behind the content and take no touches.
 */
import { StyleSheet, View } from "react-native";
import { useTheme } from "~/theme";

export const CONNECTOR = {
  /** Line weight: a little heavier than a hairline so it survives on the dark ground (F15). */
  stroke: 1.5,
  /** The turn's radius. */
  radius: 10,
  /** The line starts this far under the avatar and stops this far before the content it points at. */
  gap: 4,
} as const;

/** Down the left edge, then right along the bottom edge with a rounded turn. */
export function Elbow({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  const { color } = useTheme();
  return <View pointerEvents="none" style={[styles.elbow, { left, top, width, height, borderColor: color.border }]} />;
}

/** A straight vertical run from `top` to `bottom` of its parent. */
export function Rail({ left, top, bottom }: { left: number; top: number; bottom: number }) {
  const { color } = useTheme();
  return <View pointerEvents="none" style={[styles.rail, { left, top, bottom, borderColor: color.border }]} />;
}

const styles = StyleSheet.create({
  elbow: {
    position: "absolute",
    borderLeftWidth: CONNECTOR.stroke,
    borderBottomWidth: CONNECTOR.stroke,
    borderBottomLeftRadius: CONNECTOR.radius,
  },
  rail: { position: "absolute", width: 0, borderLeftWidth: CONNECTOR.stroke },
});
