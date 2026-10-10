/**
 * Events on the phone (S8.7, D-296; the web's `EventsScreen`, Owarine's event board): real games as yes/no questions,
 * soonest close first, each with its pools live and Yes / No in place; the ones under way and settled after; how a
 * question settles (the committee named, each signer and what it reads) and your calls below. The board, signing and
 * the relay are `@senryo/calls` `useEventsFlow`, the web's own. Until the book is on this network the board says what
 * it waits for, and how it settles stays readable.
 */
import type { CommitteeView, EventCallView } from "@senryo/api-client";
import { callResultText, committeeLine, eventPhase, feeLine, leagueName, REFUND_RULE } from "@senryo/calls";
import { type EventsFlow, useEventsFlow } from "@senryo/calls/react";
import { EVENTS, LEAGUES } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EventCard, eventRoute } from "./EventCard";
import { SourceMark } from "./SourceMark";

/** The flow both event screens share, with the phone's effects. */
export function usePhoneEvents(): EventsFlow {
  const account = useAccount();
  return useEventsFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () => router.push(accountRequiredRoute("call an event", "/events")),
  });
}

export function EventsScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useServerSeconds();
  const flow = usePhoneEvents();
  const open = flow.events.filter((e) => eventPhase(e, now) === "open");
  const rest = flow.events.filter((e) => eventPhase(e, now) !== "open");
  const blocked = flow.limits ? null : "Events are Practice only";
  const empty = !flow.live
    ? "Events aren't open yet."
    : flow.boardStatus === "failed"
      ? "The board can't be read right now · it retries on its own"
      : open.length === 0 && rest.length === 0
        ? flow.boardStatus === "unknown"
          ? "Reading the board…"
          : "No games open right now · new ones list as their day comes up"
        : null;
  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
    >
      <Text style={[TYPE.body, { color: color.inkMuted }]}>Real games · Yes or No · winners share the losing side</Text>
      <View style={styles.leagues}>
        {LEAGUES.map((l) => (
          <View key={l.key} style={styles.league}>
            <SourceMark source="league" league={l.key} />
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{leagueName(l.key)}</Text>
          </View>
        ))}
      </View>
      {empty ? (
        <Text accessibilityLiveRegion="polite" style={[TYPE.body, { color: color.inkMuted }]}>
          {empty}
        </Text>
      ) : null}
      {open.map((e) => (
        <EventCard key={e.eventId} event={e} flow={flow} now={now} blocked={blocked} />
      ))}
      {rest.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
            Under way and settled
          </Text>
          {rest.map((e) => (
            <EventCard key={e.eventId} event={e} flow={flow} now={now} blocked={blocked} />
          ))}
        </View>
      ) : null}
      <HowItSettles committee={flow.committee} />
      <YourCalls calls={flow.calls} signedIn={Boolean(flow.owner)} />
    </ScrollView>
  );
}

export function HowItSettles({ committee }: { committee: CommitteeView | null }) {
  const { color } = useTheme();
  return (
    <View style={styles.section} accessibilityLabel="How it settles">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        How it settles
      </Text>
      {committee ? (
        <>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{committeeLine(committee)}</Text>
          {committee.members.map((m) => (
            <View key={m.address} style={[styles.row, { borderBottomColor: color.hairline }]}>
              <View style={styles.flex}>
                <View style={styles.league}>
                  <SourceMark source={m.source} />
                  <Text style={[TYPE.rowTitle, { color: color.ink }]}>{m.name}</Text>
                </View>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>Reads {m.reads}</Text>
              </View>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{shortAddress(m.address)}</Text>
            </View>
          ))}
        </>
      ) : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{REFUND_RULE}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {feeLine(EVENTS.feeBps)} · Practice, test dollars · calls close at the start, no cash-out
      </Text>
    </View>
  );
}

function YourCalls({ calls, signedIn }: { calls: readonly EventCallView[]; signedIn: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.section} accessibilityLabel="Your event calls">
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        Your calls
      </Text>
      {calls.length === 0 ? (
        signedIn ? (
          <Text style={[TYPE.body, { color: color.inkMuted }]}>Calls you make show here.</Text>
        ) : (
          <Button
            label="Sign in to call"
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => router.push(accountRequiredRoute("call an event", "/events"))}
          />
        )
      ) : (
        calls.map((c) => (
          <Pressable
            key={c.ticketId.toString()}
            accessibilityRole="link"
            onPress={() => router.push(eventRoute(c.eventId))}
            style={[styles.row, { borderBottomColor: color.hairline }]}
          >
            <Text numberOfLines={2} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
              {c.question}
            </Text>
            <Text
              style={[
                TYPE.caption,
                { color: c.status === "won" ? color.up : c.status === "lost" ? color.down : color.inkMuted },
              ]}
            >
              {callResultText(c)}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  leagues: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.sm },
  league: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.lg },
  section: { gap: SPACE.md },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
