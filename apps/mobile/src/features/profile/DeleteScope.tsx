/**
 * What "Delete my data" removes, said exactly (A9; App Store 5.1.1(v)), as three compact row lists — Senryo's servers,
 * this phone, what stays — each row a title, with the longer reasons behind an ⓘ (D-237 copy budget). After the
 * delete, the server's own counts per item.
 */
import { HANDLE_TOMBSTONE_DAYS, type SocialDelete } from "@senryo/api-client";
import { StyleSheet, Text, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel } from "~/components/kit/Surface";
import { InfoTip } from "~/features/setup/InfoTip";
import { SPACE, TYPE, useTheme } from "~/theme";
import { dayLabel } from "./format";
import { SectionHeading } from "./SectionHeading";

interface Line {
  title: string;
  info?: string;
}

export const SERVER_SCOPE: readonly Line[] = [
  {
    title: "Profile and username",
    info: `Username, name, bio and avatar. The username stays on hold for ${HANDLE_TOMBSTONE_DAYS} days so nobody can pose as you; only you can take it back.`,
  },
  { title: "Follows, blocks and mutes" },
  { title: "Posts, likes and reports", info: "With the replies and likes on your posts, and reports about them." },
  { title: "Trades in the feed" },
  { title: "Price alerts" },
  { title: "Notifications", info: "This phone's push token and what your notifications said." },
  {
    title: "Backup passkey copy",
    info: "The encrypted recovery copy a backup passkey opens. Your main passkey still opens the account.",
  },
  { title: "Deposit watches" },
  { title: "Synced settings" },
];

export const DEVICE_SCOPE: readonly Line[] = [
  { title: "Sign-in and Face ID unlock" },
  { title: "Settings and setup progress" },
  { title: "Terms and risk records" },
  { title: "Cached names and watchlist" },
  { title: "Diagnostics log" },
];

export const KEPT_SCOPE: readonly Line[] = [
  {
    title: "Onchain history",
    info: "Your trades, deposits, withdrawals and balances on Monad are public and permanent; nobody can delete them. Your money stays at your address.",
  },
  {
    title: "Your passkey",
    info: "It lives with Apple, Google or your password manager and still opens this account. Remove it there if you want it gone.",
  },
  {
    title: "Others’ blocks of you",
    info: "Blocks and mutes other people set, and moderation decisions, are their safety records.",
  },
  {
    title: "Transactions in flight",
    info: "A transaction still settling keeps its record on this phone until its outcome is known.",
  },
];

export function ScopeList({ title, lines }: { title: string; lines: readonly Line[] }) {
  return (
    <View style={styles.section}>
      <SectionHeading>{title}</SectionHeading>
      <Panel>
        {lines.map((line) => (
          <ListRow
            key={line.title}
            title={line.title}
            {...(line.info ? { trailing: <InfoTip title={line.title} body={line.info} /> } : {})}
          />
        ))}
      </Panel>
    </View>
  );
}

/** What the server reported deleting, one row per item with its count. */
export function DeletedSummary({ outcome }: { outcome: SocialDelete }) {
  const { color } = useTheme();
  const d = outcome.deleted;
  const until = outcome.handleHeldUntil ? dayLabel(outcome.handleHeldUntil) : undefined;
  const rows: readonly [string, string][] = [
    ["Profile", d.profile ? "Deleted" : "None"],
    ["Follows", String(d.follows)],
    ["Blocks and mutes", String(d.blocks + d.mutes)],
    ["Posts and replies", String(d.posts)],
    ["Likes", String(d.likes)],
    ["Reports", String(d.reports)],
    ["Trades in the feed", String(d.feedEvents)],
    ["Price alerts", String(d.alerts)],
    ["Push tokens", String(d.pushTokens)],
    ["Notifications", String(d.notifications)],
    ["Backup passkey copies", String(d.vaults)],
    ["Deposit watches", String(d.inboxWatches)],
    ["Synced settings", d.prefs ? "Deleted" : "None"],
  ];
  return (
    <View style={styles.section}>
      <Panel>
        {rows.map(([label, value]) => (
          <ListRow
            key={label}
            title={label}
            trailing={<Text style={[TYPE.rowAmount, { color: color.text2 }]}>{value}</Text>}
          />
        ))}
      </Panel>
      {until ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Username on hold until {until}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
});
