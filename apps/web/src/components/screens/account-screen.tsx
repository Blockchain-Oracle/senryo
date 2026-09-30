"use client";

import { StarterPanel } from "@/components/auth/starter-panel";
import { SectionLabel } from "@/components/shell/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { DataPanel } from "./account/data-panel";
import { DiagnosticsPanel } from "./account/diagnostics-panel";
import { IdentityPanel } from "./account/identity-panel";
import { RecoveryPanel } from "./account/recovery-panel";
import { SecurityPanel } from "./account/security-panel";

/** Account (plan §2.4; F06 mode, F07 recovery, F08 proof, F09 data, F60 security). */
export function AccountScreen() {
  const account = useAccount();
  const signedIn = account.hint !== undefined;
  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <SectionLabel>Account</SectionLabel>
      <IdentityPanel />
      {signedIn ? (
        <>
          <SectionLabel>Starter funds</SectionLabel>
          <StarterPanel className="mx-4" />
          <div id="security" className="scroll-mt-28">
            <SectionLabel>Security</SectionLabel>
            <SecurityPanel />
          </div>
          <SectionLabel>Recovery</SectionLabel>
          <RecoveryPanel />
        </>
      ) : null}
      <SectionLabel>Mode</SectionLabel>
      <div className="mx-4 border border-border">
        <div className="flex items-center justify-between border-border border-b px-3 py-3">
          <div>
            <p className="font-mono text-caption">PRACTICE · {ACTIVE_NETWORK.name.toUpperCase()}</p>
            <p className="text-caption text-muted-foreground">Testnet funds with no real value — live now.</p>
          </div>
          <span className="rounded-xs border border-primary/50 px-1.5 py-0.5 font-mono text-micro text-primary">
            ACTIVE
          </span>
        </div>
        <div className="flex items-center justify-between border-border border-b px-3 py-3 opacity-70">
          <div>
            <p className="font-mono text-caption">MAINNET</p>
            <p className="text-caption text-muted-foreground">Real money. Opens with the mainnet deploy.</p>
          </div>
          <span className="rounded-xs border border-border px-1.5 py-0.5 font-mono text-micro text-muted-foreground">
            NOT LIVE
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="font-mono text-caption">THEME</p>
            <p className="text-caption text-muted-foreground">Desk dark or paper light.</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
      <SectionLabel>Diagnostics</SectionLabel>
      <DiagnosticsPanel />
      <SectionLabel>Data</SectionLabel>
      <DataPanel />
    </div>
  );
}
