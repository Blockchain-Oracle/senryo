/**
 * Who another trader is (Fomo F16 grammar, F2 steps 2–3; the same order as the own profile): a 64 pt avatar, name,
 * @handle with "Follows you", the bio, "3 Following · 12 Followers" (each opens its list), the meta line (mode ·
 * joined), then Follow and Send. Send (F6, F-D5) shows only for someone else who is public here with no block either
 * way, and opens the send flow with their @handle (or address) filled in — it is re-resolved before anything is signed.
 */
import type { Address } from "@senryo/account";
import type { PublicProfile } from "@senryo/api-client";
import { useFollowState } from "@senryo/query";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Send } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { followListRoute, sendToRoute } from "~/lib/constants/routes";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { FollowButton } from "./FollowButton";
import { handleOf, monthYear, nameOf, sameAddress } from "./format";
import { ModeBadge } from "./Quiet";
import { TraderAvatar } from "./TraderAvatar";
import { useSessionGate } from "./useSocialAccount";

/** F16's avatar is a 60 pt disc; the J9 brief sets ours at 64 (the own profile's size). */
const PROFILE_AVATAR = 64;
const BIO_LINES = 4;

export function TraderIdentity({ profile }: { profile: PublicProfile }) {
  const { color } = useTheme();
  const gate = useSessionGate();
  const own = sameAddress(profile.address, gate.address);
  const relation = useFollowState(
    gate.address,
    gate.status === "ready" && !own ? profile.address : undefined,
    gate.session,
  );
  const known = relation.status === "fresh" || relation.status === "stale" ? relation.value : undefined;
  const name = nameOf(profile);
  const joined = monthYear(profile.createdAt);
  return (
    <View style={styles.identity}>
      <TraderAvatar avatar={profile.avatar} address={profile.address} size={PROFILE_AVATAR} />
      <View style={styles.names}>
        <Text accessibilityRole="header" numberOfLines={2} style={[TYPE.sheetTitle, { color: color.ink }]}>
          {name}
        </Text>
        <View style={styles.handle}>
          <Text selectable style={[TYPE.row, { color: color.text3 }]}>
            {handleOf(profile)}
          </Text>
          {known?.followsYou ? (
            <Text style={[TYPE.chipLabel, styles.tag, { color: color.text2, backgroundColor: color.raised2 }]}>
              Follows you
            </Text>
          ) : null}
        </View>
      </View>
      {profile.bio ? (
        <Text numberOfLines={BIO_LINES} style={[TYPE.body, { color: color.text2 }]}>
          {profile.bio}
        </Text>
      ) : null}
      <View style={styles.counts}>
        <Count value={profile.following} label="Following" address={profile.address} list="following" />
        <Count
          value={profile.followers}
          label={profile.followers === 1 ? "Follower" : "Followers"}
          address={profile.address}
          list="followers"
        />
      </View>
      <View style={styles.meta}>
        <ModeBadge />
        {joined ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Joined {joined}</Text> : null}
      </View>
      {own ? null : (
        <View style={styles.actions}>
          <FollowButton other={profile.address} name={name} />
          {known?.blocked ? null : (
            <Button
              label="Send"
              variant="secondary"
              size="sm"
              block={false}
              leading={<Send size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.ink} />}
              accessibilityHint={`Send money to ${handleOf(profile)}`}
              onPress={() => router.push(sendToRoute(profile.handle ? `@${profile.handle}` : profile.address) as Href)}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** "3 Following": the figure in full ink, the word quiet (F16); opens the list. */
function Count({
  value,
  label,
  address,
  list,
}: {
  value: number;
  label: string;
  address: Address;
  list: "followers" | "following";
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(followListRoute(address, list) as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      hitSlop={SPACE.md}
    >
      <Text style={[TYPE.row, { color: color.text2 }]}>
        <Text style={[TYPE.rowStrong, { color: color.ink }]}>{value}</Text> {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { gap: SPACE.md },
  names: { gap: SPACE.xxs },
  handle: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  tag: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
  counts: { flexDirection: "row", alignItems: "center", gap: SPACE.xl },
  meta: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
