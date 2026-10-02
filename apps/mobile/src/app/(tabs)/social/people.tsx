import { type Href, router, Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { Search } from "~/components/kit/symbols";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { People } from "~/features/social/People";
import { socialSearchRoute } from "~/lib/constants/routes";
import { SIZE, useTheme } from "~/theme";

/** `/social/people` — People (F1, Fomo F29/F30), pushed on the Social stack: Leaderboard · Friends, and Search. */
export default function PeopleScreen() {
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "People",
          headerRight: () => (
            <UtilityButton label="Search traders" onPress={() => router.push(socialSearchRoute("traders") as Href)}>
              <Search size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          ),
        }}
      />
      <People />
    </Screen>
  );
}
