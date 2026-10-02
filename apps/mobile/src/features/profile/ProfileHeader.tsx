/**
 * The person at the top of You (Fomo F16, adapted): avatar with the quiet "Edit profile" plate across from it (F16's
 * Rewards position), the display name, @handle, the bio or a quiet "Add a bio", following / followers, and one line
 * of facts (open positions, joined). Everything sits bare on the page — no card. The address is not here: it lives on
 * the Account identity page. Counts come from the public view of the selected network and are never invented: a
 * profile that isn't listed there says so instead of showing zeros.
 */
import type { Address } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { usePositions } from "@senryo/query";
import { type Href, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { CalendarDays, ChartCandlestick, Plus } from "~/components/kit/symbols";
import { followsRoute, profileEditRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { joinedLabel } from "./format";
import { portrait } from "./portrait";
import { Tap } from "./Tap";
import { type OwnProfile, useOwnProfile } from "./useOwnProfile";

type Ready = Extract<OwnProfile, { kind: "ready" }>;

/** F16's avatar is a 60 pt disc; the J9 brief sets ours at 64. */
export const PROFILE_AVATAR = 64;
/** The bio shows this many lines on the tab; the editor shows all of it. A long display name wraps once. */
const BIO_LINES = 4;
const NAME_LINES = 2;
/** The plus beside "Add a bio" sits in a small filled disc (F16 draws a dashed ring; we don't draw borders). */
const ADD_DISC = SIZE.icon;
const ADD_GLYPH = SIZE.iconSm;

/** The avatar alone, for the tab bar once the header has scrolled away. */
export function CompactAvatar() {
  const { address, profile } = useOwnProfile();
  const chosen = profile.kind === "ready" ? profile.identity?.avatar : undefined;
  return <Avatar {...portrait(chosen, address)} size={SIZE.avatarSm} />;
}

export function ProfileHeader() {
  const { address, profile } = useOwnProfile();
  const ready = profile.kind === "ready" ? profile : undefined;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.top}>
          <Avatar {...portrait(ready?.identity?.avatar, address)} size={PROFILE_AVATAR} />
          {ready ? (
            <Button
              label="Edit profile"
              variant="outline"
              size="sm"
              block={false}
              style={styles.edit}
              onPress={() => router.push(ROUTES.accountProfile as Href)}
            />
          ) : null}
        </View>
        {ready ? <Names profile={ready} address={address} /> : <Waiting profile={profile} address={address} />}
      </View>
      {ready ? (
        <>
          <Bio text={ready.identity?.bio ?? null} />
          <Follows profile={ready} />
          <Facts createdAt={ready.identity?.createdAt} address={address} />
        </>
      ) : null}
    </View>
  );
}

/** Display name, or the @handle, or the way to get one; the @handle (or the short address) under it. */
function Names({ profile, address }: { profile: Ready; address: Address | undefined }) {
  const { color } = useTheme();
  const handle = profile.identity?.handle ?? null;
  const name = profile.identity?.displayName ?? null;
  return (
    <View style={styles.names}>
      {name || handle ? (
        <Text accessibilityRole="header" numberOfLines={NAME_LINES} style={[TYPE.sheetTitle, { color: color.ink }]}>
          {name ?? `@${handle}`}
        </Text>
      ) : (
        <Tap label="Add a username" onPress={() => router.push(profileEditRoute("username") as Href)}>
          <Text style={[TYPE.sheetTitle, { color: color.link }]}>Add a username</Text>
        </Tap>
      )}
      {name && handle ? (
        <Text style={[TYPE.body, { color: color.text3 }]}>@{handle}</Text>
      ) : !name && !handle && address ? (
        <Text style={[TYPE.body, { color: color.text3 }]}>{shortAddress(address)}</Text>
      ) : null}
    </View>
  );
}

/** Before the profile is known: its skeleton, or why it isn't here and the one action that brings it. */
function Waiting({ profile, address }: { profile: OwnProfile; address: Address | undefined }) {
  const { color } = useTheme();
  if (profile.kind === "loading") {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading your profile">
        <Skeleton width="44%" height={SIZE.icon} />
        <Skeleton width="28%" />
      </View>
    );
  }
  const locked = profile.kind === "locked";
  return (
    <View style={styles.names}>
      <Text accessibilityRole="header" style={[TYPE.sheetTitle, { color: color.ink }]}>
        {address ? shortAddress(address) : "Your account"}
      </Text>
      <Text style={[TYPE.body, { color: color.text3 }]}>
        {locked ? "Unlock to load your profile." : "Couldn’t load your profile. Check your connection."}
      </Text>
      <Button
        label={locked ? "Unlock" : "Try again"}
        variant="outline"
        size="sm"
        block={false}
        style={styles.recover}
        onPress={() => {
          if (profile.kind === "failed") profile.retry();
          else router.push(ROUTES.session);
        }}
      />
    </View>
  );
}

function Bio({ text }: { text: string | null }) {
  const { color } = useTheme();
  if (text) {
    return (
      <Text numberOfLines={BIO_LINES} style={[TYPE.body, { color: color.text2 }]}>
        {text}
      </Text>
    );
  }
  return (
    <Tap label="Add a bio" onPress={() => router.push(profileEditRoute("bio") as Href)} style={styles.add}>
      <View style={[styles.addDisc, { backgroundColor: color.card }]}>
        <Plus size={ADD_GLYPH} strokeWidth={SIZE.iconStroke} color={color.link} />
      </View>
      <Text style={[TYPE.bodyStrong, { color: color.link }]}>Add a bio</Text>
    </Tap>
  );
}

/** "3 Following · 0 Followers" — each opens its list. Unlisted on this network: one line saying so, no numbers. */
function Follows({ profile }: { profile: Ready }) {
  const { color } = useTheme();
  const network = useNetwork();
  if (profile.counts) {
    const { following, followers } = profile.counts;
    return (
      <View style={styles.follows}>
        <Count value={following} noun="Following" onPress={() => router.push(followsRoute("following") as Href)} />
        <Count
          value={followers}
          noun={followers === 1 ? "Follower" : "Followers"}
          onPress={() => router.push(followsRoute("followers") as Href)}
        />
      </View>
    );
  }
  if (profile.countsLoading) return <Skeleton width="48%" />;
  if (profile.listedHere === undefined) return null;
  return (
    <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
      {profile.listedHere
        ? "Following and followers couldn’t be loaded. Pull down to try again."
        : profile.identity
          ? `Not listed in ${network.modeLabel}. People can’t find or follow you here until you list your profile.`
          : "People can find and follow you once you set up your profile."}
    </Text>
  );
}

function Count({ value, noun, onPress }: { value: number; noun: string; onPress: () => void }) {
  const { color } = useTheme();
  const shown = value.toLocaleString("en-US");
  return (
    <Tap label={`${shown} ${noun}`} hint="Opens the list" onPress={onPress} style={styles.count}>
      <Text style={[TYPE.rowAmount, { color: color.ink }]}>{shown}</Text>
      <Text style={[TYPE.row, { color: color.text2 }]}>{noun}</Text>
    </Tap>
  );
}

/** F16's line of facts, with the two this account really has: open positions in this mode, and when it joined. */
function Facts({ createdAt, address }: { createdAt: string | undefined; address: Address | undefined }) {
  const { color } = useTheme();
  const positions = usePositions(address);
  const open = positions.status === "fresh" || positions.status === "stale" ? positions.value.length : undefined;
  const joined = createdAt ? joinedLabel(createdAt) : undefined;
  if (open === undefined && !joined) return null;
  return (
    <View style={styles.facts}>
      {open === undefined ? null : (
        <View style={styles.fact}>
          <ChartCandlestick size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {open === 0 ? "No open positions" : `${open} open position${open === 1 ? "" : "s"}`}
          </Text>
        </View>
      )}
      {joined ? (
        <View style={styles.fact}>
          <CalendarDays size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{joined}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  head: { gap: SPACE.md },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  /** Centred on the avatar, as F16's Rewards plate is (a sized-to-label button otherwise hugs the top). */
  edit: { alignSelf: "center" },
  names: { gap: SPACE.xxs },
  loading: { gap: SPACE.sm },
  recover: { marginTop: SPACE.md },
  add: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  addDisc: {
    width: ADD_DISC,
    height: ADD_DISC,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  follows: { flexDirection: "row", alignItems: "center", gap: SPACE.lgPlus },
  count: { flexDirection: "row", alignItems: "baseline", gap: SPACE.xs },
  facts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: SPACE.lg, rowGap: SPACE.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
