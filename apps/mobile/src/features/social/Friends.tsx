/**
 * People → Friends (Fomo F30, C30): who you follow, who follows you, and the network's recommended traders with a
 * Follow button and why each is suggested (their 30-day result in the mode's money). Lists show only accounts listed
 * on the active network, so Practice and Mainnet differ. Following never copies a trade.
 */
import type { Address } from "@senryo/account";
import type { Recommendation } from "@senryo/api-client";
import { type SessionRunner, socialKeys, useFollowList, useFollowRecommendations, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ErrorState } from "~/components/kit/states";
import { ROUTES } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { SPACE, useTheme } from "~/theme";
import { FollowButton } from "./FollowButton";
import { isNotFound, nameOf, sameAddress } from "./format";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine, SectionHeading } from "./Quiet";
import { useQueryError } from "./useQueryError";
import { useSessionGate } from "./useSocialAccount";

export function Friends() {
  const gate = useSessionGate();
  if (gate.status === "guest") {
    return (
      <QuietLine
        text="Create an account to follow traders"
        action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}
      />
    );
  }
  if (gate.status === "locked") {
    return <QuietLine text="Unlock to see who you follow" action={{ label: "Unlock", onPress: gate.open }} />;
  }
  if (gate.status === "failed") {
    return (
      <QuietLine
        text="Couldn’t confirm it’s you, so your lists stayed closed"
        action={{ label: "Try again", onPress: gate.open }}
      />
    );
  }
  if (gate.status === "pending" || !gate.address || !gate.session) return <PeopleSkeleton />;
  return <Lists me={gate.address} session={gate.session} />;
}

function Lists({ me, session }: { me: Address; session: SessionRunner }) {
  const network = useNetwork();
  const following = useFollowList(me, "following");
  const followers = useFollowList(me, "followers");
  const mine = following.reading;
  // The whole list is in hand: a follower's button can say "Following" without asking per row.
  const followed = (mine.status === "fresh" || mine.status === "stale") && !following.hasMore ? mine.value : undefined;
  const unlisted = isNotFound(useQueryError(socialKeys.list(network.chainId, "following", me)));
  return (
    <View style={styles.sections}>
      {unlisted ? (
        <QuietLine
          tight
          text={`Your profile isn’t listed on ${network.modeLabel}, so who you follow isn’t shown here`}
          action={{ label: "Profile settings", onPress: () => router.navigate(ROUTES.profileSettings as Href) }}
        />
      ) : (
        <>
          <FollowSection
            title="Following"
            direction="following"
            me={me}
            list={following}
            empty="You don’t follow anyone yet"
          />
          <FollowSection
            title="Followers"
            direction="followers"
            me={me}
            list={followers}
            empty="Nobody follows you yet"
            hintFor={(address) =>
              followed ? followed.some((entry) => sameAddress(entry.address, address)) : undefined
            }
          />
        </>
      )}
      <Recommended session={session} />
    </View>
  );
}

function FollowSection({
  title,
  direction,
  me,
  list,
  empty,
  hintFor,
}: {
  title: string;
  direction: "followers" | "following";
  me: Address;
  list: ReturnType<typeof useFollowList>;
  empty: string;
  /** Whether you follow this account, when that is already known; a row in Following always is. */
  hintFor?: (address: Address) => boolean | undefined;
}) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const { reading } = list;
  const known = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <View style={styles.section}>
      <SectionHeading title={title} count={known && !list.hasMore ? known.length : undefined} />
      {reading.status === "unknown" ? <PeopleSkeleton rows={2} /> : null}
      {reading.status === "failed" ? (
        <ErrorState
          diagnosis={reading.error}
          retry={() => void client.invalidateQueries({ queryKey: socialKeys.list(env.chainId, direction, me) })}
        />
      ) : null}
      {known && known.length === 0 ? <QuietLine tight text={empty} /> : null}
      {known ? (
        <View>
          {known.map((entry) => (
            <PersonRow
              key={entry.address}
              person={entry}
              trailing={
                <FollowButton
                  other={entry.address}
                  name={nameOf(entry)}
                  hint={hintFor ? hintFor(entry.address) : true}
                />
              }
            />
          ))}
        </View>
      ) : null}
      {list.hasMore ? (
        <Button
          label="Show more"
          variant="secondary"
          size="sm"
          block={false}
          loading={list.loadingMore}
          onPress={list.loadMore}
          style={styles.center}
        />
      ) : null}
    </View>
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
      {items && items.length === 0 ? (
        <QuietLine tight text="Nobody is ranked on this network yet. Suggestions appear as people trade." />
      ) : null}
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
    <Text style={{ color: trader.netPnlUsd6 >= 0n ? color.up : color.down }}>
      {signedUsd(trader.netPnlUsd6)} in 30 days
    </Text>
  );
}

const styles = StyleSheet.create({
  sections: { gap: SPACE.xl },
  section: { gap: SPACE.sm },
  center: { alignSelf: "center" },
});
