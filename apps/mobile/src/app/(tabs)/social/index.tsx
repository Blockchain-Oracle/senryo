import type { FeedScope } from "@senryo/api-client";
import { socialKeys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SquarePen, UsersRound } from "~/components/kit/symbols";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { Feed } from "~/features/social/Feed";
import { NewActivity } from "~/features/social/NewActivity";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { ROUTES, socialPeopleRoute } from "~/lib/constants/routes";
import { HAIRLINE_PX, SIZE, SPACE, useTheme } from "~/theme";

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "friends", label: "Following" },
] as const satisfies readonly { value: FeedScope; label: string }[];

/** Where the pill floats: under the fixed bar (touch row + its padding + hairline) and the pinned tabs. */
const PILL_TOP = SIZE.touch + SPACE.md + HAIRLINE_PX + SIZE.touch + SPACE.sm + SIZE.touch;

/**
 * Social (F4, Fomo F15): the feed, with Global · Following underline tabs pinned under the bar. Round utilities open
 * People (F1: the leaderboard first, Fomo F29/F30) and compose a thesis. "New activity" floats over the top of the
 * list when the socket reports a newer row; a tap reloads from the top. Pull to refresh reloads this network's social
 * reads. Selection survives tab switches (the tab stays mounted); Practice and Mainnet are separate datasets.
 */
export default function Social() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const env = useQueryEnv();
  const client = useQueryClient();
  const gate = useSessionGate();
  const [scope, setScope] = useState<FeedScope>("global");
  // The Following feed is only read once the api knows who is asking; until then there is nothing to be newer than.
  const watching = scope === "global" || gate.status === "ready";
  return (
    <View style={styles.fill}>
      <CollapsingScreen
        left={<TabTitle>Social</TabTitle>}
        utilities={
          <>
            <UtilityButton label="People and leaderboard" onPress={() => router.push(socialPeopleRoute as Href)}>
              <UsersRound size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
            <UtilityButton
              label="Write a thesis"
              onPress={() =>
                router.push((gate.status === "guest" ? ROUTES.accountRequired : ROUTES.composeThesis) as Href)
              }
            >
              <SquarePen size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          </>
        }
        sticky={
          <View style={styles.tabs}>
            <UnderlineTabs options={SCOPES} value={scope} onChange={setScope} label="Feed" />
          </View>
        }
        onRefresh={() => client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) })}
      >
        <Feed scope={scope} onFindPeople={() => router.push(socialPeopleRoute as Href)} />
      </CollapsingScreen>
      {watching ? (
        <View pointerEvents="box-none" style={[styles.pill, { top: insets.top + PILL_TOP }]}>
          <NewActivity scope={scope} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabs: { paddingHorizontal: SIZE.gutter },
  pill: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
