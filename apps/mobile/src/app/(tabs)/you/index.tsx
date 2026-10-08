import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Settings } from "~/components/kit/symbols";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { CompactAvatar, ProfileHeader } from "~/features/profile/ProfileHeader";
import { QuietState } from "~/features/profile/QuietState";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * The own profile (F2; Fomo F16): Settings in the bar; the person — avatar (edit), name, @handle,
 * bio. Calls, stats and the leaderboard place return with S5/S8 (D-256). A guest gets the tab's title and one way in.
 */
export default function You() {
  const account = useAccount();
  const { color } = useTheme();
  const guest = account.ready && !account.hint;
  const address = account.hint?.address;
  return (
    <CollapsingScreen
      left={guest ? <TabTitle>Profile</TabTitle> : null}
      compact={
        guest ? undefined : (
          <View style={styles.compact}>
            <CompactAvatar />
          </View>
        )
      }
      utilities={
        <UtilityButton label="Settings" onPress={() => router.push(ROUTES.accountSettings)}>
          <Settings size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </UtilityButton>
      }
    >
      {guest ? (
        <QuietState
          line="Create an account to have a profile"
          action={{
            label: "Create account",
            variant: "primary",
            onPress: () => router.push(accountRequiredRoute("make a call")),
          }}
        />
      ) : null}
      {address ? (
        <View style={styles.page}>
          <ProfileHeader />
        </View>
      ) : null}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  /** The bar's middle centres its content; the compact avatar belongs at the leading edge, where the title would be. */
  compact: { alignSelf: "flex-start" },
  page: { gap: SPACE.xl },
});
