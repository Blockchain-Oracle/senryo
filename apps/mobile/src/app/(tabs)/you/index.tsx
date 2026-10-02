import { router } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { Settings, Share2 } from "~/components/kit/symbols";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { ActivityButton, UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { CompactAvatar, ProfileHeader } from "~/features/profile/ProfileHeader";
import { ProfileResult } from "~/features/profile/ProfileResult";
import { ProfileTabs } from "~/features/profile/ProfileTabs";
import { QuietState } from "~/features/profile/QuietState";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { watchLink } from "~/lib/share-link";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * The own profile (F2; Fomo F16): Share · History · Settings circles in the bar; the person — avatar (edit), name,
 * @handle, bio, follows, a meta line, "Make public on Mainnet" when private here; the period result with its chart;
 * then Positions · Trades. No settings rows here (they are behind the gear). Share sends the canonical watch link with
 * this network's chainId. A guest gets the tab's title and one way in.
 */
export default function You() {
  const account = useAccount();
  const network = useNetwork();
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
        <>
          {address ? (
            <UtilityButton
              label="Share profile"
              onPress={() => void Share.share({ message: watchLink(address, network.chainId) })}
            >
              <Share2 size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
            </UtilityButton>
          ) : null}
          <ActivityButton />
          <UtilityButton label="Settings" onPress={() => router.push(ROUTES.accountSettings)}>
            <Settings size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </UtilityButton>
        </>
      }
    >
      {guest ? (
        <QuietState
          line="Create an account to have a profile"
          action={{
            label: "Create account",
            variant: "primary",
            onPress: () => router.push(accountRequiredRoute("follow")),
          }}
        />
      ) : null}
      {address ? (
        <View style={styles.page}>
          <ProfileHeader />
          <ProfileResult address={address} />
          <ProfileTabs address={address} />
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
