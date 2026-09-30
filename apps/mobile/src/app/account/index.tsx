import { type Href, router, Stack } from "expo-router";
import { View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Screen } from "~/components/kit/Screen";
import { Panel, SectionLabel } from "~/components/kit/Surface";
import { DiagnosticsPanel } from "~/features/auth/DiagnosticsPanel";
import { IdentityPanel } from "~/features/auth/IdentityPanel";
import { StarterCard } from "~/features/auth/StarterCard";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE } from "~/theme";

/** F60 settings shell: every section the plan lists, each opening its own screen. */
const SECTIONS: { label: string; rows: { title: string; detail: string; href: Href }[] }[] = [
  {
    label: "ACCOUNT",
    rows: [
      { title: "Security", detail: "Session, idle lock, Face ID per trade", href: ROUTES.accountSecurity },
      { title: "Recovery", detail: "Passkey sync, second passkey", href: ROUTES.accountRecovery },
      { title: "Practice or real", detail: "Testnet practice vs mainnet", href: ROUTES.accountMode },
    ],
  },
  {
    label: "APP",
    rows: [
      { title: "Preferences", detail: "Sounds, haptics, theme", href: ROUTES.accountPreferences },
      { title: "Notifications", detail: "Fills, liquidation, deposits, card", href: ROUTES.accountNotifications },
    ],
  },
  {
    label: "MONEY",
    rows: [
      { title: "Orders", detail: "Open TP/SL orders", href: ROUTES.orders },
      { title: "Activity", detail: "Fills, deposits, card, funding", href: ROUTES.activity },
      { title: "Withdraw", detail: "To your address, another address or chain", href: ROUTES.withdraw },
      { title: "Liquidity pool", detail: "Deposit and redeem", href: ROUTES.lp },
    ],
  },
  {
    label: "SUPPORT",
    rows: [
      { title: "Help", detail: "FAQ and contact", href: ROUTES.accountHelp },
      { title: "Status", detail: "RPC, oracle, indexer, services", href: ROUTES.status },
      { title: "Delete my data", detail: "This device and encrypted preferences", href: ROUTES.accountDeleteData },
    ],
  },
];

export default function Account() {
  const account = useAccount();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Account" }} />
      <IdentityPanel />
      {account.hint ? <StarterCard /> : null}
      {SECTIONS.map((section) => (
        <View key={section.label} style={{ gap: SPACE.sm }}>
          <SectionLabel>{section.label}</SectionLabel>
          <Panel>
            {section.rows.map((row, i) => (
              <ListRow
                key={row.title}
                title={row.title}
                detail={row.detail}
                first={i === 0}
                onPress={() => router.push(row.href)}
              />
            ))}
          </Panel>
        </View>
      ))}
      <View style={{ gap: SPACE.sm }}>
        <SectionLabel>DIAGNOSTICS</SectionLabel>
        <DiagnosticsPanel />
      </View>
    </Screen>
  );
}
