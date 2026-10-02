/**
 * People (F1, Fomo F29/F30): underline tabs Leaderboard · Friends, the leaderboard first (§0.9). Friends holds your
 * Following and Followers — one row each, opening the list — and Recommended traders with a blue Follow and why each
 * is suggested ("+$1,240 · 30d"). Lists show only accounts listed on the active network. Following never copies a
 * trade.
 */
import type { Address } from "@senryo/account";
import type { Recommendation } from "@senryo/api-client";
import { type SessionRunner, socialKeys, useFollowRecommendations, useProfile, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { ChevronRight } from "~/components/kit/symbols";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { fire } from "~/feedback/fire";
import { type FollowDirection, followsRoute, ROUTES } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { FollowButton } from "./FollowButton";
import { isNotFound, nameOf } from "./format";
import { Leaderboard } from "./Leaderboard";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine, SectionHeading } from "./Quiet";
import { useQueryError } from "./useQueryError";
import { useSessionGate } from "./useSocialAccount";

const VIEWS = [
  { value: "leaderboard", label: "Leaderboard" },
  { value: "friends", label: "Friends" },
] as const;
type View_ = (typeof VIEWS)[number]["value"];

/** The width of a count while it loads. */
const COUNT_SKELETON = 28;

export function People() {
  const [view, setView] = useState<View_>("leaderboard");
  return (
    <View style={styles.page}>
      <UnderlineTabs options={VIEWS} value={view} onChange={setView} label="People" />
      {view === "leaderboard" ? <Leaderboard /> : <Friends />}
    </View>
  );
}

function Friends() {
  const gate = useSessionGate();
  if (gate.status === "guest") {
    return (
      <QuietLine
        text="Follow traders"
        action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
      />
    );
  }
  if (gate.status === "locked") {
    return <QuietLine text="Unlock to see your people" action={{ label: "Unlock", onPress: gate.open }} />;
  }
  if (gate.status === "failed") {
    return <QuietLine text="Couldn’t confirm it’s you" action={{ label: "Try again", onPress: gate.open }} />;
  }
  if (gate.status === "pending" || !gate.address || !gate.session) return <PeopleSkeleton />;
  return (
    <View style={styles.sections}>
      <Lists me={gate.address} />
      <Recommended session={gate.session} />
    </View>
  );
}

/** "Following 3" and "Followers 12" from your public profile here; unlisted here, the counts say how to change that. */
function Lists({ me }: { me: Address }) {
  const env = useQueryEnv();
  const profile = useProfile(me);
  const unlisted = isNotFound(useQueryError(socialKeys.profile(env.chainId, me)));
  if (unlisted) {
    return (
      <QuietLine
        tight
        text="Not public here"
        action={{ label: "Make public", onPress: () => router.push(ROUTES.accountProfile as Href) }}
      />
    );
  }
  const known = profile.status === "fresh" || profile.status === "stale" ? profile.value : undefined;
  return (
    <View>
      <CountRow label="Following" value={known?.following} direction="following" />
      <CountRow label="Followers" value={known?.followers} direction="followers" />
    </View>
  );
}

function CountRow({
  label,
  value,
  direction,
}: {
  label: string;
  value: number | undefined;
  direction: FollowDirection;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(followsRoute(direction) as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
    >
      <Text style={[TYPE.rowTitle, styles.grow, { color: color.ink }]}>{label}</Text>
      {value === undefined ? (
        <Skeleton width={COUNT_SKELETON} />
      ) : (
        <Text style={[TYPE.rowPrice, { color: color.text2 }]}>{value}</Text>
      )}
      <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </Pressable>
  );
}

function Recommended({ session }: { session: SessionRunner }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useFollowRecommendations(session);
  const items = reading.status === "fresh" || reading.status === "stale" ? reading.value.items : undefined;
  return (
    <View style={styles.section}>
      <SectionHeading title="Recommended" />
      {reading.status === "unknown" ? <PeopleSkeleton rows={3} /> : null}
      {reading.status === "failed" ? (
        <ErrorState
          diagnosis={reading.error}
          retry={() => void client.invalidateQueries({ queryKey: socialKeys.recommendations(env.chainId) })}
        />
      ) : null}
      {items && items.length === 0 ? <QuietLine tight text="Suggestions appear as people trade" /> : null}
      {items ? (
        <View>
          {items.map((trader) => (
            <PersonRow
              key={trader.address}
              person={trader}
              note={<Reason trader={trader} />}
              trailing={<FollowButton other={trader.address} name={nameOf(trader)} hint={false} />}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Why a trader is suggested: their 30-day realized result, signed, in the mode's money. */
function Reason({ trader }: { trader: Recommendation }) {
  const { color } = useTheme();
  return (
    <Text style={{ color: trader.netPnlUsd6 >= 0n ? color.up : color.down }}>{signedUsd(trader.netPnlUsd6)} · 30d</Text>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  sections: { gap: SPACE.xl },
  section: { gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  grow: { flex: 1 },
});
