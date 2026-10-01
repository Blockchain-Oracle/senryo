import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE } from "~/theme";

const SECTIONS = [
  { value: "feed", label: "Feed" },
  { value: "people", label: "People" },
] as const;
const FEED_SCOPES = [
  { value: "global", label: "Global" },
  { value: "friends", label: "Friends" },
] as const;
const PEOPLE_VIEWS = [
  { value: "friends", label: "Friends" },
  { value: "leaderboard", label: "Leaderboard" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];
type FeedScope = (typeof FEED_SCOPES)[number]["value"];
type PeopleView = (typeof PEOPLE_VIEWS)[number]["value"];

/** Reserved copy per view (Codex S1b.7 consult #7): honest about what this build has, never an invented empty list. */
const RESERVED = {
  global: { why: "Global feed", detail: "The global feed isn’t available in this version." },
  friends: { why: "Friends feed", detail: "The friends feed isn’t available in this version." },
  people: { why: "Friends", detail: "Your people list isn’t available in this version." },
  leaderboard: { why: "Leaderboard", detail: "Rankings aren’t available in this version." },
} as const;

/**
 * Social (S1b.7 shell; the screens are J8, S1b.14 with S12b): the working Feed / People segments (C14) with Feed's
 * Global / Friends and People's Friends / Leaderboard, each a labelled reserved view until J8 builds it on the live
 * api (D-174, D-211/D-212). Selection survives tab switches (the tab stays mounted).
 */
export default function Social() {
  const [section, setSection] = useState<Section>("feed");
  const [scope, setScope] = useState<FeedScope>("global");
  const [people, setPeople] = useState<PeopleView>("friends");
  const reserved =
    section === "feed" ? RESERVED[scope] : people === "leaderboard" ? RESERVED.leaderboard : RESERVED.people;
  return (
    <CollapsingScreen
      tab="social"
      left={<TabTitle>Social</TabTitle>}
      sticky={
        <View style={styles.segments}>
          <View style={styles.gutter}>
            <Segmented options={SECTIONS} value={section} onChange={setSection} label="Social section" />
          </View>
          {section === "feed" ? (
            <ChipRow options={FEED_SCOPES} value={scope} onChange={setScope} label="Feed audience" />
          ) : (
            <ChipRow options={PEOPLE_VIEWS} value={people} onChange={setPeople} label="People view" />
          )}
        </View>
      }
    >
      <EmptyState
        why={reserved.why}
        detail={reserved.detail}
        action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}
      />
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  segments: { paddingVertical: SPACE.sm, gap: SPACE.sm },
  gutter: { paddingHorizontal: SIZE.gutter },
});
