import { MORE_NAV, type NavIcon } from "@senryo/config";
import { type Href, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  Bell,
  CircleUserRound,
  Landmark,
  Layers,
  QrCode,
  Settings,
  Signal,
  Swords,
  type SymbolIcon,
  Trophy,
  Wallet,
} from "~/components/kit/symbols";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { CompactAvatar, ProfileHeader } from "~/features/profile/ProfileHeader";
import { QuietState } from "~/features/profile/QuietState";
import { SettingsRow } from "~/features/profile/SettingsRow";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

const GLYPH: Partial<Record<NavIcon, SymbolIcon>> = {
  parlay: Layers,
  duel: Swords,
  events: Trophy,
  wallet: Wallet,
  earn: Landmark,
  profile: CircleUserRound,
  receive: QrCode,
  notifications: Bell,
  settings: Settings,
  status: Signal,
};

/**
 * More (D-268): the person on top — avatar (edit), name, @handle, bio — then every destination the dock doesn't hold,
 * from the shared navigation source. A guest gets the title and one way in.
 */
export default function More() {
  const account = useAccount();
  const { color } = useTheme();
  const guest = account.ready && !account.hint;
  const address = account.hint?.address;
  return (
    <CollapsingScreen
      left={guest ? <TabTitle>More</TabTitle> : null}
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
          <View>
            {MORE_NAV.map((item) => (
              <SettingsRow
                key={item.key}
                title={item.label}
                {...(GLYPH[item.icon] ? { icon: GLYPH[item.icon] } : {})}
                onPress={() => router.push(item.path as Href)}
              />
            ))}
          </View>
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
