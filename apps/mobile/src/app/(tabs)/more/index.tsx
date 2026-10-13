import { verdict } from "@senryo/calls";
import { MORE_NAV, type NavIcon } from "@senryo/config";
import { useStatus } from "@senryo/query";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Bell,
  CircleUserRound,
  Gamepad,
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
import { MoreSearchRow } from "~/features/search/MoreSearchRow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

const GLYPH: Partial<Record<NavIcon, SymbolIcon>> = {
  games: Gamepad,
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
 * from the shared navigation source, search first (R6.9). A guest gets one way in, then every place open to it
 * read-only (R2.14).
 */
export default function More() {
  const account = useAccount();
  const { color } = useTheme();
  const guest = account.ready && !account.hint;
  const address = account.hint?.address;
  // The Status row carries the live verdict, read only while More is in front (P6's health chip).
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const status = useStatus({ enabled: focused });
  const health = "value" in status ? verdict(status.value.components).word : null;
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
        <View style={styles.page}>
          <QuietState
            line="Your profile starts with your first call"
            action={{
              label: "Make a call",
              variant: "primary",
              onPress: () => router.navigate("/trade"),
            }}
          />
          <View>
            <MoreSearchRow />
            {MORE_NAV.filter((item) => "guest" in item && item.guest).map((item) => (
              <SettingsRow
                key={item.key}
                title={item.label}
                {...(GLYPH[item.icon] ? { icon: GLYPH[item.icon] } : {})}
                {...(item.key === "status" && health ? { value: health } : {})}
                onPress={() => router.push(item.path as Href)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {address ? (
        <View style={styles.page}>
          <ProfileHeader />
          <View>
            <MoreSearchRow />
            {MORE_NAV.map((item) => (
              <SettingsRow
                key={item.key}
                title={item.label}
                {...(GLYPH[item.icon] ? { icon: GLYPH[item.icon] } : {})}
                {...(item.key === "status" && health ? { value: health } : {})}
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
