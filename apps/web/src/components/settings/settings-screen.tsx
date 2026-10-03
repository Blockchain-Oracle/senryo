"use client";

/**
 * Settings (flow book A10; plan §0.9 "Settings": iOS grouped rows with coloured icon squares, the phone's A10 contents):
 * Account — Wallet & address, Security, Recovery, Mode; Preferences — Profile, Appearance, Notifications; About —
 * Status, Help, Terms, Privacy; Blocked & muted; Diagnostics; Delete data; Sign out at the bottom. A row opens its page
 * (`?section=`), with Back to the list. Browsing needs no passkey; loosening a setting asks for one.
 */
import {
  Activity,
  Ban,
  Bell,
  Bug,
  CircleHelp,
  FileText,
  KeyRound,
  LogOut,
  type LucideIcon,
  Palette,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ListRow } from "@/components/kit/list-row";
import { PageHeader, TabTitle } from "@/components/kit/page-header";
import { DataPanel } from "@/components/screens/account/data-panel";
import { DiagnosticsPanel } from "@/components/screens/account/diagnostics-panel";
import { IdentityPanel } from "@/components/screens/account/identity-panel";
import { RecoveryPanel } from "@/components/screens/account/recovery-panel";
import { SecurityPanel } from "@/components/screens/account/security-panel";
import { Column } from "@/components/shell/column";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { BlockedMutedSection, ModeSection, SignOutSection, StatusSection } from "./settings-sections";

const SUPPORT_EMAIL = "support@senryo.xyz";

type Section = "wallet" | "security" | "recovery" | "mode" | "status" | "blocked" | "diagnostics" | "data" | "signout";

const SECTIONS: Record<Section, { title: string; body: () => ReactNode }> = {
  wallet: { title: "Wallet & address", body: () => <IdentityPanel /> },
  security: { title: "Security", body: () => <SecurityPanel /> },
  recovery: { title: "Recovery", body: () => <RecoveryPanel /> },
  mode: { title: "Mode", body: () => <ModeSection /> },
  status: { title: "Status", body: () => <StatusSection /> },
  blocked: { title: "Blocked & muted", body: () => <BlockedMutedSection /> },
  diagnostics: { title: "Diagnostics", body: () => <DiagnosticsPanel /> },
  data: { title: "Delete data", body: () => <DataPanel /> },
  signout: { title: "Sign out", body: () => <SignOutSection /> },
};

const isSection = (v: string | null): v is Section => v !== null && v in SECTIONS;

/** A coloured icon square (iOS grouped list). */
function Glyph({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <span className={cn("grid size-8 place-items-center rounded-sm text-background", tone)}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h2 className="text-meta text-text-2">{label}</h2>
      <div className="rounded-md bg-raised-2 px-2">{children}</div>
    </section>
  );
}

const href = (s: Section) => `${ROUTES.account}?section=${s}`;

export function SettingsScreen() {
  const section = useSearchParams().get("section");
  const signedIn = useAccount().hint !== undefined;
  if (isSection(section)) {
    const s = SECTIONS[section];
    return (
      <Column className="grid gap-3">
        <PageHeader title={s.title} back={ROUTES.account} />
        {s.body()}
      </Column>
    );
  }
  return (
    <Column className="grid gap-5">
      <TabTitle>Settings</TabTitle>
      {signedIn ? (
        <Group label="Account">
          <ListRow leading={<Glyph icon={Wallet} tone="bg-primary" />} title="Wallet & address" href={href("wallet")} />
          <ListRow
            leading={<Glyph icon={Shield} tone="bg-up" />}
            title="Security"
            subtitle="Session and passkey"
            href={href("security")}
          />
          <ListRow leading={<Glyph icon={KeyRound} tone="bg-gold" />} title="Recovery" href={href("recovery")} />
          <ListRow
            leading={<Glyph icon={Waypoints} tone="bg-practice" />}
            title="Mode"
            subtitle={ACTIVE_NETWORK.modeLabel}
            href={href("mode")}
          />
        </Group>
      ) : (
        <Button asChild size="xl">
          <Link href={ROUTES.welcome}>Create account</Link>
        </Button>
      )}
      <Group label="Preferences">
        {signedIn ? (
          <ListRow
            leading={<Glyph icon={UserRound} tone="bg-primary" />}
            title="Profile"
            subtitle="Handle and visibility"
            href={ROUTES.setup}
          />
        ) : null}
        <ListRow leading={<Glyph icon={Palette} tone="bg-chart-2" />} title="Appearance" trailing={<ThemeToggle />} />
        {signedIn ? (
          <ListRow
            leading={<Glyph icon={Bell} tone="bg-down" />}
            title="Notifications"
            subtitle="The inbox"
            href={ROUTES.notifications}
          />
        ) : null}
      </Group>
      <Group label="About">
        <ListRow leading={<Glyph icon={Activity} tone="bg-up" />} title="Status" href={href("status")} />
        <ListRow
          leading={<Glyph icon={CircleHelp} tone="bg-chart-3" />}
          title="Help"
          subtitle={SUPPORT_EMAIL}
          href={`mailto:${SUPPORT_EMAIL}`}
        />
        <ListRow leading={<Glyph icon={FileText} tone="bg-text-3" />} title="Terms" href="/terms/" />
        <ListRow leading={<Glyph icon={ShieldCheck} tone="bg-text-3" />} title="Privacy" href="/privacy/" />
      </Group>
      {signedIn ? (
        <Group label="Safety">
          <ListRow leading={<Glyph icon={Ban} tone="bg-down" />} title="Blocked & muted" href={href("blocked")} />
          <ListRow leading={<Glyph icon={Bug} tone="bg-text-3" />} title="Diagnostics" href={href("diagnostics")} />
          <ListRow leading={<Glyph icon={Trash2} tone="bg-destructive" />} title="Delete data" href={href("data")} />
          <ListRow leading={<Glyph icon={LogOut} tone="bg-text-3" />} title="Sign out" href={href("signout")} />
        </Group>
      ) : null}
    </Column>
  );
}
