/**
 * A trader's followers or following (screen inventory "Followers / following"; Fomo F30's people rows): identity rows
 * with a Follow control each, newest first, page by page. Only accounts listed on the active network are counted and
 * shown, so the list differs between Practice and Mainnet. A trader who isn't public here answers 404 and the page
 * says so. Your own row carries no button.
 */
import type { Address } from "@senryo/account";
import { socialKeys, useFollowList, useProfile, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ErrorState } from "~/components/kit/states";
import { FollowButton } from "./FollowButton";
import { isNotFound, nameOf } from "./format";
import { PersonRow } from "./PersonRow";
import { PeopleSkeleton, QuietLine } from "./Quiet";
import { useQueryError } from "./useQueryError";

export type FollowDirection = "followers" | "following";

export function FollowListScreen({ address, direction }: { address: Address; direction: FollowDirection }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const profile = useProfile(address);
  const list = useFollowList(address, direction);
  const key = socialKeys.list(env.chainId, direction, address);
  const error = useQueryError(key);
  const { reading } = list;
  const owner = profile.status === "fresh" || profile.status === "stale" ? nameOf(profile.value) : undefined;
  const title = direction === "followers" ? "Followers" : "Following";
  const items = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  return (
    <Screen onRefresh={() => client.invalidateQueries({ queryKey: key })}>
      <Stack.Screen options={{ title: owner ? `${owner} · ${title}` : title }} />
      {reading.status === "unknown" ? <PeopleSkeleton /> : null}
      {reading.status === "failed" ? (
        isNotFound(error) ? (
          <QuietLine text="This profile isn’t public on this network" />
        ) : (
          <ErrorState diagnosis={reading.error} retry={() => void client.invalidateQueries({ queryKey: key })} />
        )
      ) : null}
      {items && items.length === 0 ? (
        <QuietLine
          text={
            direction === "followers"
              ? "Nobody on this network follows this trader yet"
              : "This trader doesn’t follow anyone on this network yet"
          }
        />
      ) : null}
      {items && items.length > 0 ? (
        <View>
          {items.map((entry) => (
            <PersonRow
              key={entry.address}
              person={entry}
              trailing={<FollowButton other={entry.address} name={nameOf(entry)} />}
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
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { alignSelf: "center" } });
