/**
 * What "Delete my data" removes, said exactly (direction: "Delete app data — exact local/server-data scope … onchain
 * records distinguished"; App Store 5.1.1(v)). Three plain lists: what leaves Senryo's servers (`DELETE /v1/social`
 * and `DELETE /v1/prefs`), what leaves this phone, and what stays because nobody can delete it or because it is
 * someone else's safety record. Each list is one filled group; lines are separated by their own spacing.
 */
import { HANDLE_TOMBSTONE_DAYS, type SocialDelete } from "@senryo/api-client";
import { StyleSheet, Text, View } from "react-native";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { dayLabel } from "./format";

export const SERVER_SCOPE = [
  "Your profile: username, display name and bio",
  "Who you follow, and everyone’s follow of you",
  "Your blocks and mutes",
  "Your posts and replies, with the replies and likes on them",
  "Your likes",
  "Reports you filed, and reports about your posts",
  "Your trades in the social feed",
  "Your synced security settings (stored encrypted)",
] as const;

export const USERNAME_HOLD = `Your username stays on hold for ${HANDLE_TOMBSTONE_DAYS} days so nobody can pose as you. Only you can take it back in that time.`;

export const DEVICE_SCOPE = [
  "This phone’s sign-in for the account and its Face ID or fingerprint unlock",
  "Session and security settings",
  "Setup progress, and the records that you accepted the terms and read the risk notes",
  "Which liquidation notice you last saw",
  "The diagnostics log",
  "The random ID this phone uses for rate limits",
] as const;

export const KEPT_SCOPE = [
  "Onchain history. Your trades, deposits, withdrawals and balances on Monad are public and permanent; nobody can delete them. Your money stays at your address.",
  "Your passkey. It lives with Apple, Google or your password manager and still opens this account. Remove it there if you want it gone.",
  "Blocks and mutes other people set on your account, and moderation decisions. They are other people’s safety records.",
  "Theme, sound, haptic, chart and mode choices on this phone. They hold nothing about you.",
] as const;

export function ScopeList({ title, lines }: { title: string; lines: readonly string[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        {title}
      </Text>
      <Panel style={styles.panel}>
        {lines.map((line) => (
          <View key={line} style={styles.line}>
            <View style={[styles.dot, { backgroundColor: color.text3 }]} />
            <Text style={[TYPE.rowDetail, styles.text, { color: color.text2 }]}>{line}</Text>
          </View>
        ))}
      </Panel>
    </View>
  );
}

/** What the server reported deleting, as counts — shown in place once the delete has run. */
export function DeletedSummary({ outcome }: { outcome: SocialDelete }) {
  const { color } = useTheme();
  const d = outcome.deleted;
  const until = outcome.handleHeldUntil ? dayLabel(outcome.handleHeldUntil) : undefined;
  return (
    <View style={styles.section}>
      <Panel style={styles.panel}>
        <KeyValue label="Profile" value={d.profile ? "Deleted" : "None to delete"} />
        <KeyValue label="Follows" value={String(d.follows)} />
        <KeyValue label="Blocks and mutes" value={String(d.blocks + d.mutes)} />
        <KeyValue label="Posts and replies" value={String(d.posts)} />
        <KeyValue label="Likes" value={String(d.likes)} />
        <KeyValue label="Reports" value={String(d.reports)} />
        <KeyValue label="Trades in the feed" value={String(d.feedEvents)} />
      </Panel>
      {until ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          Your username is on hold until {until}. Only you can take it back before then.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  line: { flexDirection: "row", gap: SPACE.md },
  /** Centred on the first line of text. */
  dot: {
    width: SIZE.dot,
    height: SIZE.dot,
    borderRadius: RADIUS.pill,
    marginTop: ((TYPE.rowDetail.lineHeight ?? SIZE.skeletonLine) - SIZE.dot) / 2,
  },
  text: { flex: 1 },
});
