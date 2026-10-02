/**
 * Another trader's profile (F2 for others; Fomo F16's layout, the same grammar as the own profile): Share and ⋯
 * (report / mute / block) as round utilities in the bar; who they are with Follow · Send; the period hero (realized
 * P&L, 24h · 7d · 30d · All, rank or "Not ranked"); then underline tabs Positions · Trades — positions when they share
 * this network's trades, each with Trade this, and their trades and theses as feed rows. A profile is served per
 * network: unlisted and unknown both answer 404, and the page says "Not public on Mainnet" with the explorer. Nothing
 * here signs or moves money.
 */
import type { PublicProfile } from "@senryo/api-client";
import { explorerAddressUrl } from "@senryo/config";
import { socialKeys, useFeed, useProfile, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router, Stack } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ErrorState, Skeleton } from "~/components/kit/states";
import { Ellipsis, Share2 } from "~/components/kit/symbols";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { profileActionsRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { FeedSkeleton } from "./Feed";
import { FeedRow } from "./FeedRow";
import { isNotFound, sameAddress } from "./format";
import { QuietLine } from "./Quiet";
import { profileLink, shareLink } from "./share-links";
import { TraderIdentity } from "./TraderIdentity";
import { TraderPositions } from "./TraderPositions";
import { TraderStanding } from "./TraderStanding";
import { useQueryError } from "./useQueryError";
import { useSessionGate } from "./useSocialAccount";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Rows of the feed skeleton under Trades. */
const TRADES_LOADING_ROWS = 2;

const TABS = [
  { value: "positions", label: "Positions" },
  { value: "trades", label: "Trades" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** `lookup` is an address or a handle; the api resolves either on the active network. */
export function TraderProfile({ lookup }: { lookup: string }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useProfile(lookup);
  const key = socialKeys.profile(env.chainId, lookup);
  const error = useQueryError(key);
  const profile = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <Screen onRefresh={() => client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) })}>
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
      {profile ? <Loaded profile={profile} /> : null}
    </Screen>
  );
}

function Loaded({ profile }: { profile: PublicProfile }) {
  const [tab, setTab] = useState<Tab>("positions");
  return (
    <>
      <TraderIdentity profile={profile} />
      <TraderStanding address={profile.address} />
      <View style={styles.section}>
        <UnderlineTabs options={TABS} value={tab} onChange={setTab} label="Their activity" />
        {tab === "positions" ? (
          <TraderPositions address={profile.address} shared={profile.publicTrades} />
        ) : (
          <TraderTrades profile={profile} />
        )}
      </View>
    </>
  );
}

/** Round utilities in the header (F16): Share the profile link, and ⋯ for someone else's profile. */
function HeaderActions({ profile }: { profile: PublicProfile }) {
  const { color } = useTheme();
  const network = useNetwork();
  const gate = useSessionGate();
  const own = sameAddress(profile.address, gate.address);
  return (
    <View style={styles.utilities}>
      <UtilityButton
        label="Share this profile"
        onPress={() => shareLink(profileLink(profile.address, network.chainId))}
      >
        <Share2 size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
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

/** Their trades and theses as feed rows (the public feed by actor); private trades leave only their theses. */
function TraderTrades({ profile }: { profile: PublicProfile }) {
  const network = useNetwork();
  const feed = useFeed("global", undefined, profile.address);
  const { reading } = feed;
  if (reading.status === "unknown") return <FeedSkeleton rows={TRADES_LOADING_ROWS} />;
  if (reading.status === "failed") return <ErrorState diagnosis={reading.error} />;
  const rows = reading.value;
  if (rows.length === 0) {
    return <QuietLine tight text={profile.publicTrades ? "No trades yet" : `Trades private on ${network.modeLabel}`} />;
  }
  return (
    <View>
      {rows.map((item, i) => (
        <FeedRow key={item.id} item={item} index={i} />
      ))}
      {feed.hasMore ? (
        <Button
          label="Show more"
          variant="ghost"
          size="sm"
          block={false}
          loading={feed.loadingMore}
          onPress={feed.loadMore}
          style={styles.center}
        />
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
      text={`Not public on ${network.modeLabel}`}
      {...(address
        ? {
            action: {
              label: "Explorer",
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
const AVATAR = 64;

/** The avatar disc and three lines while the profile loads (F2 states). */
function ProfileSkeleton() {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the profile"
      accessibilityState={{ busy: true }}
      style={styles.skeleton}
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
  section: { gap: SPACE.md },
  center: { alignSelf: "center" },
  skeleton: { gap: SPACE.md },
  disc: { width: AVATAR, height: AVATAR, borderRadius: RADIUS.pill },
});
