/**
 * One question on the phone (`/events/[id]`; S8.7, D-296; the web's `EventDetail`): the card to call it, the rule the
 * committee answers by, when calls close and when answers count, and each member's answer — what it read, the score
 * it saw, its statement re-hashed here against the hash the chain recorded — with every transaction.
 */
import type { EventAnswerView } from "@senryo/api-client";
import { sideWord, statementChecks, statementRead, statusLine } from "@senryo/calls";
import { type ChainId, explorerTxUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useEventDetail } from "@senryo/query";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EventCard } from "./EventCard";
import { HowItSettles, usePhoneEvents } from "./EventsScreen";
import { SourceMark } from "./SourceMark";

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const MS_PER_SECOND = 1000;
const when = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useServerSeconds();
  const valid = BYTES32.test(eventId);
  const detail = useEventDetail(valid ? eventId : null);
  const flow = usePhoneEvents();
  const quiet = !valid
    ? "This link doesn't name a question."
    : detail.status === "unknown"
      ? "Reading the question…"
      : detail.status === "failed"
        ? "This question can't be read right now · it retries on its own"
        : null;
  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      {quiet || !("value" in detail) ? (
        <Text style={[TYPE.body, { color: color.inkMuted }]}>{quiet}</Text>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={[TYPE.title, { color: color.ink }]}>{detail.value.event.question}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              Yes / No · Practice · {statusLine(detail.value.event, now)}
            </Text>
          </View>
          <EventCard
            event={detail.value.event}
            flow={flow}
            now={now}
            blocked={flow.limits ? null : "Events are Practice only"}
          />
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
              The rule
            </Text>
            <Text style={[TYPE.body, { color: color.ink }]}>{detail.value.event.rules}</Text>
            <Fact label="Starts" value={when(detail.value.event.startsAt)} />
            <Fact label="Calls close" value={when(detail.value.event.closesAt)} />
            <Fact
              label="Answers count"
              value={`${when(detail.value.event.answerFrom)} – ${when(detail.value.event.answerBy)}`}
            />
            <Fact label="Terms hash" value={shortAddress(detail.value.event.termsHash)} />
            {detail.value.event.listedTx ? (
              <TxLink chainId={flow.chainId} hash={detail.value.event.listedTx} label="Listed on chain" />
            ) : null}
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
              The committee's answers
            </Text>
            {detail.value.committee.members.map((m) => (
              <MemberRow
                key={m.address}
                name={m.name}
                source={m.source}
                league={detail.value.event.league}
                answer={detail.value.answers.find((a) => a.member.toLowerCase() === m.address.toLowerCase()) ?? null}
                chainId={flow.chainId}
              />
            ))}
          </View>
          <HowItSettles committee={detail.value.committee} />
        </>
      )}
    </ScrollView>
  );
}

function Fact(p: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.label}</Text>
      <Text style={[TYPE.caption, styles.flexEnd, { color: color.ink }]}>{p.value}</Text>
    </View>
  );
}

function MemberRow(p: {
  name: string;
  source: string | undefined;
  league: string;
  answer: EventAnswerView | null;
  chainId: ChainId;
}) {
  const { color } = useTheme();
  const a = p.answer;
  const read = a ? statementRead(a) : null;
  const checks = a ? statementChecks(a) : false;
  return (
    <View style={[styles.member, { borderBottomColor: color.hairline }]}>
      <View style={styles.fact}>
        <View style={styles.named}>
          <SourceMark source={p.source} league={p.league} />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{p.name}</Text>
        </View>
        <Text style={[TYPE.rowTitle, { color: a ? (a.yes ? color.up : color.down) : color.inkMuted }]}>
          {a ? sideWord(a.yes) : "Not yet"}
        </Text>
      </View>
      {a && read ? (
        <>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            Saw “{read.read}” on {new URL(read.source).host}
          </Text>
          <Text style={[TYPE.caption, { color: checks ? color.inkMuted : color.down }]}>
            {checks ? "✓ Statement re-hashed here: matches the chain" : "✗ Statement doesn't match its hash"}
          </Text>
          {a.txHash ? (
            <TxLink chainId={p.chainId} hash={a.txHash} label="Answer on chain" />
          ) : (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>Signed · on its way to the chain</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

function TxLink(p: { chainId: ChainId; hash: string; label: string }) {
  const { color } = useTheme();
  return (
    <Text
      accessibilityRole="link"
      onPress={() => void Linking.openURL(explorerTxUrl(p.chainId, p.hash))}
      style={[TYPE.caption, styles.link, { color: color.ink }]}
    >
      {p.label}
    </Text>
  );
}

const styles = StyleSheet.create({
  named: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.xl },
  section: { gap: SPACE.sm },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm },
  flexEnd: { flex: 1, textAlign: "right" },
  member: { gap: SPACE.xxs, paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { textDecorationLine: "underline" },
});
