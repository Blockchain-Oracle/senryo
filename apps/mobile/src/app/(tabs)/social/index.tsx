import type { FeedScope } from "@senryo/api-client";
import { socialKeys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { SquarePen } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { Segmented } from "~/components/kit/Segmented";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { Feed } from "~/features/social/Feed";
import { Friends } from "~/features/social/Friends";
import { Leaderboard } from "~/features/social/Leaderboard";
import { NewActivity } from "~/features/social/NewActivity";
import { useSessionGate } from "~/features/social/useSocialAccount";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

const SECTIONS = [
  { value: "feed", label: "Feed" },
  { value: "people", label: "People" },
] as const;
const FEED_SCOPES = [
  { value: "global", label: "Global" },
  { value: "friends", label: "Friends" },
] as const satisfies readonly { value: FeedScope; label: string }[];
const PEOPLE_VIEWS = [
  { value: "friends", label: "Friends" },
  { value: "leaderboard", label: "Leaderboard" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];
type PeopleView = (typeof PEOPLE_VIEWS)[number]["value"];

/**
 * Social (J8, S1b.14 on the S12b api; Fomo F15/F29/F30, C27/C30): Feed (Global / Friends) and People (Friends /
 * Leaderboard) on the live api. The selectors pin under the bar; "New activity" joins the audience chips when the
 * socket reports a newer row; the round utility composes a thesis. Pull to refresh reloads this network's social
 * reads. Selection survives tab switches (the tab stays mounted); Practice and Mainnet are separate datasets.
 */
export default function Social() {
  const { color } = useTheme();
  const env = useQueryEnv();
  const client = useQueryClient();
  const gate = useSessionGate();
  const [section, setSection] = useState<Section>("feed");
  const [scope, setScope] = useState<FeedScope>("global");
  const [people, setPeople] = useState<PeopleView>("friends");
  // The Friends feed is only read once the api knows who is asking; until then there is nothing to be newer than.
  const watching = scope === "global" || gate.status === "ready";
  return (
    <CollapsingScreen
      left={<TabTitle>Social</TabTitle>}
      utilities={
        <UtilityButton
          label="Write a thesis"
          onPress={() => router.push((gate.status === "guest" ? ROUTES.accountRequired : ROUTES.composeThesis) as Href)}
        >
          <SquarePen size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </UtilityButton>
      }
      sticky={
        <View style={styles.segments}>
          <View style={styles.gutter}>
            <Segmented options={SECTIONS} value={section} onChange={setSection} label="Social section" />
          </View>
          {section === "feed" ? (
            <View style={styles.audience}>
              <View style={styles.chips}>
                <ChipRow options={FEED_SCOPES} value={scope} onChange={setScope} label="Feed audience" />
              </View>
              {watching ? <NewActivity scope={scope} /> : null}
            </View>
          ) : (
            <ChipRow options={PEOPLE_VIEWS} value={people} onChange={setPeople} label="People view" />
          )}
        </View>
      }
      onRefresh={() => client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) })}
    >
      {section === "feed" ? (
        <Feed
          scope={scope}
          onFindPeople={() => {
            setPeople("friends");
            setSection("people");
          }}
        />
      ) : people === "friends" ? (
        <Friends />
      ) : (
        <Leaderboard />
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  segments: { paddingVertical: SPACE.sm, gap: SPACE.sm },
  gutter: { paddingHorizontal: SIZE.gutter },
  audience: { flexDirection: "row", alignItems: "center", paddingRight: SIZE.gutter },
  chips: { flex: 1 },
});
