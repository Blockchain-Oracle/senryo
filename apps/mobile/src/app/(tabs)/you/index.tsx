import { type Href, router } from "expo-router";
import { Settings } from "lucide-react-native";
import { View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { AlertsButton, UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { DiagnosticsPanel } from "~/features/auth/DiagnosticsPanel";
import { IdentityPanel } from "~/features/auth/IdentityPanel";
import { SessionChip } from "~/features/auth/SessionChip";
import { StarterCard } from "~/features/auth/StarterCard";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * You (S1b.7 shell, D-176; J9 rebuilds it in S1b.15): profile and account identity, then account, activity,
 * security, preferences and support — every section the old Account page held (F60), each opening its own page.
 * `/account` links land here.
 */
const SECTIONS: { label: string; rows: { title: string; detail: string; href: Href }[] }[] = [
  {
    label: "Account",
    rows: [
      { title: "Security", detail: "Session, idle lock, Face ID per trade", href: ROUTES.accountSecurity },
      { title: "Recovery", detail: "Passkey sync, second passkey", href: ROUTES.accountRecovery },
      { title: "Practice or real", detail: "Testnet practice vs mainnet", href: ROUTES.accountMode },
    ],
  },
  {
    label: "Activity",
    rows: [
      { title: "Activity", detail: "Fills, deposits, card, funding", href: ROUTES.activity },
      { title: "Orders", detail: "Open TP/SL orders", href: ROUTES.orders },
      { title: "Withdraw", detail: "To your address, another address or chain", href: ROUTES.withdraw },
      { title: "Liquidity pool", detail: "Deposit and redeem", href: ROUTES.lp },
    ],
  },
  {
    label: "Preferences",
    rows: [
      { title: "Preferences", detail: "Sounds, haptics, theme", href: ROUTES.accountPreferences },
      { title: "Notifications", detail: "Fills, liquidation, deposits, card", href: ROUTES.accountNotifications },
    ],
  },
  {
    label: "Support",
    rows: [
      { title: "Help", detail: "FAQ and contact", href: ROUTES.accountHelp },
      { title: "Status", detail: "RPC, oracle, indexer, services", href: ROUTES.status },
      { title: "Delete my data", detail: "This device and encrypted preferences", href: ROUTES.accountDeleteData },
      { title: "Terms of use", detail: "What Senryo is and what you take on", href: ROUTES.accountTerms as Href },
      { title: "Privacy", detail: "What we keep and how to remove it", href: ROUTES.accountPrivacy as Href },
    ],
  },
];

export default function You() {
  const account = useAccount();
  const { color } = useTheme();
  return (
    <CollapsingScreen
      left={<TabTitle>You</TabTitle>}
      utilities={
        <>
          <AlertsButton />
          <UtilityButton label="Account and settings" onPress={() => router.push(ROUTES.accountPreferences)}>
            <Settings size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </UtilityButton>
        </>
      }
      status={<SessionChip />}
    >
      <IdentityPanel />
      {account.hint ? <StarterCard /> : null}
      {SECTIONS.map((section) => (
        <View key={section.label} style={{ gap: SPACE.sm }}>
          <SectionLabel>{section.label}</SectionLabel>
          <Panel>
            {section.rows.map((row) => (
              <ListRow key={row.title} title={row.title} detail={row.detail} onPress={() => router.push(row.href)} />
            ))}
          </Panel>
        </View>
      ))}
      <View style={{ gap: SPACE.sm }}>
        <SectionLabel>Diagnostics</SectionLabel>
        <DiagnosticsPanel />
      </View>
    </CollapsingScreen>
  );
}
