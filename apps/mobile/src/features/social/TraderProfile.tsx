/**
 * A trader's public profile (Fomo F16/F19 adapted, with F13's Follow beside the identity; screen inventory "Trader
 * profile / public watch"): avatar, name, @handle, bio, following / followers that open their lists, when they joined,
 * their result on the board per period, their open positions when they share this network's trades, and what the
 * feed last showed of them. A profile is served per network: unlisted and unknown both answer 404, and the page says
 * exactly that. Nothing here signs or moves money.
 */
import type { Address } from "@senryo/account";
import type { PublicProfile } from "@senryo/api-client";
import { explorerAddressUrl, WEB_ORIGIN } from "@senryo/config";
import { socialKeys, useFeed, useFollowState, useProfile, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router, Stack } from "expo-router";
import { Ellipsis, Share as ShareIcon } from "lucide-react-native";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { fire } from "~/feedback/fire";
import { followListRoute, profileActionsRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { FeedSkeleton } from "./Feed";
import { FeedRow } from "./FeedRow";
import { FollowButton } from "./FollowButton";
import { handleOf, isNotFound, monthYear, nameOf, sameAddress } from "./format";
import { ModeBadge, QuietLine, SectionHeading } from "./Quiet";
import { TraderAvatar } from "./TraderAvatar";
import { TraderPositions } from "./TraderPositions";
import { TraderStanding } from "./TraderStanding";
import { useQueryError } from "./useQueryError";
import { useSessionGate } from "./useSocialAccount";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Rows of the feed skeleton under "Recent activity". */
const ACTIVITY_LOADING_ROWS = 2;

/** `lookup` is an address or a handle; the api resolves either on the active network. */
export function TraderProfile({ lookup }: { lookup: string }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useProfile(lookup);
  const key = socialKeys.profile(env.chainId, lookup);
  const error = useQueryError(key);
  const profile = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <Screen>
      <Stack.Screen
        options={{ title: "", ...(profile ? { headerRight: () => <HeaderActions profile={profile} /> } : {}) }}
      />
      {reading.status === "unknown" ? <ProfileSkeleton /> : null}
      {reading.status === "failed" ? (
        isNotFound(error) ? (
          <NotPublic lookup={lookup} />
        ) : (
          <ErrorState diagnosis={reading.error} retry={() => void client.invalidateQueries({ queryKey: key })} />
        )
      ) : null}
      {profile ? (
        <>
          <Identity profile={profile} />
          <TraderStanding address={profile.address} />
          <TraderPositions address={profile.address} shared={profile.publicTrades} />
          <ProfileActivity address={profile.address} />
        </>
      ) : null}
    </Screen>
  );
}

/** Round utilities in the header (F16): share the read-only link, and the overflow for someone else's profile. */
function HeaderActions({ profile }: { profile: PublicProfile }) {
  const { color } = useTheme();
  const network = useNetwork();
  const gate = useSessionGate();
  const own = sameAddress(profile.address, gate.address);
  return (
    <View style={styles.utilities}>
      <UtilityButton
        label="Share this profile"
        onPress={() =>
          void Share.share({ message: `${WEB_ORIGIN}/watch/?address=${profile.address}&chainId=${network.chainId}` })
        }
      >
        <ShareIcon size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </UtilityButton>
      {own ? null : (
        <UtilityButton
          label="More: report, mute or block"
          onPress={() =>
            router.push(
              (gate.status === "guest" ? ROUTES.accountRequired : profileActionsRoute(profile.address)) as Href,
            )
          }
        >
          <Ellipsis size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </UtilityButton>
      )}
    </View>
  );
}

function Identity({ profile }: { profile: PublicProfile }) {
  const { color } = useTheme();
  const gate = useSessionGate();
  const own = sameAddress(profile.address, gate.address);
  const relation = useFollowState(
    gate.address,
    gate.status === "ready" && !own ? profile.address : undefined,
    gate.session,
  );
  const followsYou = (relation.status === "fresh" || relation.status === "stale") && relation.value.followsYou;
  const name = nameOf(profile);
  const joined = monthYear(profile.createdAt);
  return (
    <View style={styles.identity}>
      <View style={styles.top}>
        <TraderAvatar avatar={profile.avatar} address={profile.address} size={SIZE.avatarLg} />
        {own ? (
          <Button
            label="Edit profile"
            variant="outline"
            size="sm"
            block={false}
            onPress={() => router.navigate(ROUTES.profileSettings as Href)}
            style={styles.centered}
          />
        ) : (
          <FollowButton other={profile.address} name={name} />
        )}
      </View>
      <View style={styles.names}>
        <Text accessibilityRole="header" style={[TYPE.sheetTitle, { color: color.ink }]}>
          {name}
        </Text>
        <View style={styles.handle}>
          <Text selectable style={[TYPE.row, { color: color.text3 }]}>
            {handleOf(profile)}
          </Text>
          {followsYou ? (
            <Text style={[TYPE.chipLabel, styles.tag, { color: color.text2, backgroundColor: color.raised2 }]}>
              Follows you
            </Text>
          ) : null}
        </View>
      </View>
      {profile.bio ? <Text style={[TYPE.body, { color: color.text2 }]}>{profile.bio}</Text> : null}
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

/** What the feed last showed of this trader: their rows in the latest page of this network's public activity. */
export function ProfileActivity({ address }: { address: Address }) {
  const feed = useFeed("global", undefined, address);
  const { reading } = feed;
  const rows = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <View style={styles.section}>
      <SectionHeading title="Recent activity" />
      {reading.status === "unknown" ? <FeedSkeleton rows={ACTIVITY_LOADING_ROWS} /> : null}
      {reading.status === "failed" ? (
        <QuietLine tight text="The feed couldn’t be loaded. Pull down to try again." />
      ) : null}
      {rows && rows.length === 0 ? <QuietLine tight text="No shared activity yet" /> : null}
      {rows?.map((item, i) => (
        <FeedRow key={item.id} item={item} index={i} />
      ))}
      {feed.hasMore ? (
        <Button label="More activity" variant="ghost" loading={feed.loadingMore} onPress={feed.loadMore} />
      ) : null}
    </View>
  );
}

/** Unlisted and unknown read the same (the api never says which); an address can still be opened on the explorer. */
function NotPublic({ lookup }: { lookup: string }) {
  const network = useNetwork();
  const address = ADDRESS.test(lookup) ? lookup : undefined;
  return (
    <QuietLine
      text="This profile isn’t public on this network"
      {...(address
        ? {
            action: {
              label: `Open in the ${network.modeLabel} explorer`,
              onPress: () => void Linking.openURL(explorerAddressUrl(network.chainId, address)),
            },
          }
        : {})}
    />
  );
}

const NAME_WIDTH = "50%";
const HANDLE_WIDTH = "32%";
const BIO_WIDTH = "86%";

function ProfileSkeleton() {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the profile"
      accessibilityState={{ busy: true }}
      style={styles.identity}
    >
      <View style={[styles.disc, { backgroundColor: color.skeleton }]} />
      <Skeleton width={NAME_WIDTH} height={TYPE.sheetTitle.lineHeight ?? SIZE.skeletonLine} />
      <Skeleton width={HANDLE_WIDTH} />
      <Skeleton width={BIO_WIDTH} />
    </View>
  );
}

const styles = StyleSheet.create({
  utilities: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  identity: { gap: SPACE.md },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  centered: { alignSelf: "center" },
  names: { gap: SPACE.xxs },
  handle: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  tag: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
  counts: { flexDirection: "row", alignItems: "center", gap: SPACE.xl },
  meta: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  section: { gap: SPACE.sm },
  disc: { width: SIZE.avatarLg, height: SIZE.avatarLg, borderRadius: RADIUS.pill },
});
