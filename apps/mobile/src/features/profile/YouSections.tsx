/**
 * The rows under the person on You (J9; Fomo F16's page rhythm, F20's rich rows): four named groups — Account, Money,
 * App, About — each row with an action icon in a small disc, a title and one line on what is behind it. Every
 * destination the old Account page had is still here; Diagnostics moved off the tab to a row in About. A guest sees
 * only the rows that work without an account.
 */
import { shortAddress } from "@senryo/core";
import { type Href, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ListRow } from "~/components/kit/ListRow";
import { Panel, useGroupFill } from "~/components/kit/Surface";
import {
  ArrowLeftRight,
  Bell,
  Gauge,
  IdCard,
  Info,
  KeyRound,
  Lock,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Trash,
} from "~/components/kit/symbols";
import { UTILITY_ICON } from "~/components/shell/Utilities";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, RADIUS, SIZE, SPACE, useTheme } from "~/theme";
import { SectionHeading } from "./SectionHeading";

interface Row {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  /** Needs an account: hidden from a guest. */
  account?: true;
}

/** `address` is the account's, shortened, so the row names what it opens; `mode` / `money` are the selected network's. */
function sections(mode: string, money: string, address: string | undefined): { label: string; rows: Row[] }[] {
  return [
    {
      label: "Account",
      rows: [
        {
          title: "Wallet address",
          detail: address ? `${address} · copy or share` : "Your address, copy and watch link",
          href: ROUTES.accountIdentity,
          icon: IdCard,
          account: true,
        },
        {
          title: "Security",
          detail: "Session length, idle lock, checks per trade",
          href: ROUTES.accountSecurity,
          icon: ShieldCheck,
          account: true,
        },
        {
          title: "Recovery",
          detail: "Passkey sync, backup passkey, export",
          href: ROUTES.accountRecovery,
          icon: KeyRound,
          account: true,
        },
        {
          title: "Trading mode",
          detail: `Now in ${mode} · ${money}`,
          href: ROUTES.accountMode,
          icon: ArrowLeftRight,
          account: true,
        },
      ],
    },
    {
      label: "App",
      rows: [
        {
          title: "Preferences",
          detail: "Sounds, haptics, theme",
          href: ROUTES.accountPreferences,
          icon: SlidersHorizontal,
        },
        {
          title: "Notifications",
          detail: "Price alerts, activity and delivery preferences",
          href: ROUTES.accountNotifications,
          icon: Bell,
        },
        { title: "Status", detail: "Network, prices and services", href: ROUTES.status, icon: Signal },
      ],
    },
    {
      label: "About",
      rows: [
        { title: "About & sources", detail: "Where every number comes from", href: ROUTES.accountHelp, icon: Info },
        {
          title: "Terms of use",
          detail: "What Senryo is and what you take on",
          href: ROUTES.accountTerms,
          icon: ScrollText,
        },
        { title: "Privacy", detail: "What we keep and how to remove it", href: ROUTES.accountPrivacy, icon: Lock },
        {
          title: "Delete my data",
          detail: "Your profile, posts and this phone",
          href: ROUTES.accountDeleteData,
          icon: Trash,
          account: true,
        },
        { title: "Diagnostics", detail: "What this phone measured", href: ROUTES.accountDiagnostics, icon: Gauge },
      ],
    },
  ];
}

/** The row's action icon in a 36 pt disc one step lighter than its group (F16's round utilities, at row scale). */
function RowIcon({ icon: Glyph }: { icon: LucideIcon }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  return (
    <View style={[styles.disc, { backgroundColor: fill }]}>
      <Glyph size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.text2} />
    </View>
  );
}

export function YouSections({ guest }: { guest: boolean }) {
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const practice = network.key === "testnet";
  const groups = sections(
    network.modeLabel,
    practice ? "paper money" : "real money",
    address ? shortAddress(address) : undefined,
  )
    .map((group) => ({ ...group, rows: guest ? group.rows.filter((row) => !row.account) : group.rows }))
    .filter((group) => group.rows.length > 0);
  return (
    <>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <SectionHeading>{group.label}</SectionHeading>
          <Panel>
            {group.rows.map((row) => (
              <ListRow
                key={row.title}
                title={row.title}
                detail={row.detail}
                leading={<RowIcon icon={row.icon} />}
                onPress={() => router.push(row.href as Href)}
              />
            ))}
          </Panel>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  /** A section's name sits on the page gutter above its group, as F16's "Positions" does. */
  group: { gap: SPACE.md },
  disc: {
    width: BUTTON.utility,
    height: BUTTON.utility,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
