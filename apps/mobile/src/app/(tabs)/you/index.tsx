import { WEB_ORIGIN } from "@senryo/config";
import { router } from "expo-router";
import { Settings, Share2 } from "lucide-react-native";
import { Share, StyleSheet, Text, View } from "react-native";
import { PasskeyGlyph } from "~/components/identity/PasskeyGlyph";
import { Button } from "~/components/kit/Button";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { ActivityButton, UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { SessionChip } from "~/features/auth/SessionChip";
import { StarterCard } from "~/features/auth/StarterCard";
import { PositionsSection } from "~/features/home/PositionsSection";
import { TradingPerformance } from "~/features/portfolio/TradingPerformance";
import { CompactAvatar, ProfileHeader } from "~/features/profile/ProfileHeader";
import { RecentActivity } from "~/features/profile/RecentActivity";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * You (J9, S1b.15; Fomo F16 adapted): the tab is the person. Round utilities and the mode sit in the bar; under it
 * the profile — avatar, name, @handle, bio, following / followers, Edit profile — then the practice-funds card while
 * there is something to claim, then the account's pages in four groups (Account, Money, App, About). F16 has no page
 * title, so an account's bar has none either: the avatar appears in it once the header has scrolled away. The balance,
 * period chips and positions of F16 are Home's in Senryo (direction §5), and the address moved to Account identity.
 * A guest gets the tab's title, one quiet invitation and the rows that need no account. `/account` links land here.
 */
export default function You() {
  const account = useAccount();
  const network = useNetwork();
  const { color } = useTheme();
  const guest = account.ready && !account.hint;
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
          {account.hint ? (
            <UtilityButton
              label="Share profile"
              onPress={() =>
                void Share.share({
                  message: `${WEB_ORIGIN}/watch/?address=${account.hint?.address}&chainId=${network.chainId}`,
                })
              }
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
      status={<SessionChip />}
    >
      {guest ? (
        <View style={styles.invite}>
          <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>Create an account to have a profile</Text>
          <Button
            label="Create account"
            leading={<PasskeyGlyph color={color.primaryForeground} />}
            onPress={() => router.push(ROUTES.accountRequired)}
          />
        </View>
      ) : (
        <ProfileHeader />
      )}
      {account.hint ? <StarterCard hideWhenClaimed /> : null}
      {account.hint ? (
        <>
          <TradingPerformance address={account.hint.address} />
          <PositionsSection />
          <RecentActivity address={account.hint.address} />
        </>
      ) : null}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  /** The bar's middle centres its content; the compact avatar belongs at the leading edge, where the title would be. */
  compact: { alignSelf: "flex-start" },
  invite: { gap: SPACE.lg, paddingVertical: SPACE.xl },
  center: { textAlign: "center" },
});
