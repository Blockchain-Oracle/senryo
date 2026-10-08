/**
 * The inbox list (G1 step 2; grouping ported from 21st.dev uvain/notification-panel, id 27135: rows grouped by day,
 * the sentence first, time quiet beside it). Groups are Today / Earlier; a row is the subject's real mark, a one-line
 * title and the time; an unread row sits on a raised fill (no dots). A tap marks it read and opens the screen its push
 * opens, through the app's deep-link path (`linkTarget`: a link for the other mode goes through the mode sheet).
 */
import type { AppNotification } from "@senryo/api-client";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SectionLabel } from "~/components/kit/Surface";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { linkTarget } from "~/lib/deep-link";
import { clockTime, dayLabel } from "~/lib/format";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { SubjectMark } from "./SubjectMark";

const ROW_STAGGER_MS = 30;
/** Rows past this index appear without a delay (a long page never waits on its stagger). */
const STAGGER_MAX = 10;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function InboxList({
  items,
  unread,
  onOpen,
}: {
  items: readonly AppNotification[];
  /** Ids that were unread when the inbox opened (they keep their fill for this visit). */
  unread: ReadonlySet<string>;
  onOpen: (n: AppNotification) => void;
}) {
  const today = startOfToday();
  const groups = [
    { title: "Today", rows: items.filter((n) => Date.parse(n.createdAt) >= today) },
    { title: "Earlier", rows: items.filter((n) => Date.parse(n.createdAt) < today) },
  ].filter((g) => g.rows.length > 0);
  let index = 0;
  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <SectionLabel>{group.title}</SectionLabel>
          {group.rows.map((n) => {
            const delay = Math.min(index, STAGGER_MAX) * ROW_STAGGER_MS;
            index += 1;
            return (
              <Animated.View
                key={n.id}
                entering={FadeInDown.duration(TIMING.staggerItem)
                  .delay(delay)
                  .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
              >
                <NotificationRow
                  n={n}
                  unread={unread.has(n.id)}
                  time={
                    Date.parse(n.createdAt) >= today
                      ? clockTime(Date.parse(n.createdAt))
                      : dayLabel(Date.parse(n.createdAt))
                  }
                  onPress={() => onOpen(n)}
                />
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The inbox lists one network, so the push title's "Practice · " prefix is noise here. */
function rowTitle(title: string, modeLabel: string): string {
  const prefix = `${modeLabel} · `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

function NotificationRow({
  n,
  unread,
  time,
  onPress,
}: {
  n: AppNotification;
  unread: boolean;
  time: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const network = useNetwork();
  const press = usePressScale();
  const title = rowTitle(n.title, network.modeLabel);
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole={n.url ? "link" : "text"}
        accessibilityLabel={`${unread ? "Unread. " : ""}${title}, ${time}`}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? color.rowPressed : unread ? color.raised2 : color.transparent },
        ]}
      >
        <SubjectMark subject={n.subject} chainId={n.chainId} />
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[unread ? TYPE.rowStrong : TYPE.row, styles.title, { color: color.ink }]}
        >
          {title}
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
          {time}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Where a row goes: its push's own screen, through the deep-link path; nothing when it names none. */
export function openNotification(n: AppNotification, activeChainId: number): void {
  if (!n.url) return;
  router.push(linkTarget(n.url, activeChainId) as Href);
}

const styles = StyleSheet.create({
  groups: { gap: SPACE.xl },
  group: { gap: SPACE.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: RADIUS.md,
  },
  title: { flex: 1 },
});
