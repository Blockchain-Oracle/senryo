/**
 * The person at the top of the own profile (F2; Fomo F16): the avatar with its pencil (tap to edit), the display name,
 * @handle, the bio or "Add a bio", "3 Following · 0 Followers" (each opens its list), and one meta line with symbols —
 * trades and joined. When the profile isn't public on this network, a chip "Make public on Mainnet" opens Edit profile
 * on its visibility (with the shared-address ⓘ there). Everything sits bare on the page; the address is on Wallet &
 * address. Counts come from the public view of this network and are never invented.
 */
import type { Address } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { useLeaderboard } from "@senryo/query";
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { CalendarDays, ChartCandlestick, Globe, Plus, SquarePen } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { followsRoute, profileEditRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { joinedLabel } from "./format";
import { portrait } from "./portrait";
import { Tap } from "./Tap";
import { type OwnProfile, useOwnProfile } from "./useOwnProfile";

type Ready = Extract<OwnProfile, { kind: "ready" }>;

/** F16's avatar is a 60 pt disc; the J9 brief sets ours at 64. */
export const PROFILE_AVATAR = 64;
const BIO_LINES = 4;
const NAME_LINES = 2;
const ADD_DISC = SIZE.icon;
const ADD_GLYPH = SIZE.iconSm;
/** The pencil badge on the avatar's lower right (F16). */
const PENCIL_DISC = SIZE.icon;
const PENCIL_GLYPH = 12;
/** The edit form opened on the visibility section. */
export const VISIBILITY_EDIT = "/account/profile?focus=visibility";

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
      <EditableAvatar avatar={ready?.identity?.avatar} address={address} />
      {ready ? <Names profile={ready} address={address} /> : <Waiting profile={profile} address={address} />}
      {ready ? (
        <>
          <Bio text={ready.identity?.bio ?? null} />
          <Follows profile={ready} />
          <Meta createdAt={ready.identity?.createdAt} />
          {ready.listedHere === false ? <MakePublic /> : null}
        </>
      ) : null}
    </View>
  );
}

function EditableAvatar({ avatar, address }: { avatar: string | null | undefined; address: Address | undefined }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        fire("tick");
        router.push(ROUTES.accountProfile as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel="Edit profile"
      style={styles.avatar}
    >
      <Animated.View style={press.style}>
        <Avatar {...portrait(avatar, address)} size={PROFILE_AVATAR} />
        <View style={[styles.pencil, { backgroundColor: color.raised2, borderColor: color.ground }]}>
          <SquarePen size={PENCIL_GLYPH} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </View>
      </Animated.View>
    </Pressable>
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

/** Before the profile is known: its skeleton, or the one action that brings it. */
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
      <Button
        label={locked ? "Unlock to load" : "Couldn’t load · Retry"}
        variant="secondary"
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

/** "3 Following · 0 Followers" — each opens its list. Unlisted here: nothing (the chip below says why). */
function Follows({ profile }: { profile: Ready }) {
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
  return profile.countsLoading ? <Skeleton width="48%" /> : null;
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

/** F16's line of facts: all-time trades on this network and when the profile was made. */
function Meta({ createdAt }: { createdAt: string | undefined }) {
  const { color } = useTheme();
  const board = useLeaderboard("all", "all");
  const you = board.status === "fresh" || board.status === "stale" ? board.value.you : undefined;
  const trades = you?.trades ?? undefined;
  const joined = createdAt ? joinedLabel(createdAt) : undefined;
  if (trades === undefined && !joined) return null;
  return (
    <View style={styles.facts}>
      {trades === undefined ? null : (
        <View style={styles.fact}>
          <ChartCandlestick size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
            {trades} {trades === 1 ? "trade" : "trades"}
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

/** Not listed on this network: one chip that opens the visibility choice. */
function MakePublic() {
  const { color } = useTheme();
  const network = useNetwork();
  const press = usePressScale();
  const tone = network.key === "mainnet" ? color.mainnet : color.practice;
  const wash = network.key === "mainnet" ? color.mainnetWash : color.practiceWash;
  return (
    <Animated.View style={[styles.chipWrap, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(VISIBILITY_EDIT as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Make public on ${network.modeLabel}`}
        style={[styles.chip, { backgroundColor: wash }]}
      >
        <Globe size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={tone} />
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.chipCategory, { color: tone }]}>
          Make public on {network.modeLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  avatar: { alignSelf: "flex-start" },
  pencil: {
    position: "absolute",
    right: -SPACE.xxs,
    bottom: -SPACE.xxs,
    width: PENCIL_DISC,
    height: PENCIL_DISC,
    borderRadius: RADIUS.pill,
    borderWidth: SPACE.xxs,
    alignItems: "center",
    justifyContent: "center",
  },
  names: { gap: SPACE.xxs },
  loading: { gap: SPACE.sm },
  recover: { marginTop: SPACE.sm },
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
  chipWrap: { alignSelf: "flex-start" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    height: SIZE.chipRowHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
  },
});
