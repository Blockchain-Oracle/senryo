import { ChevronRight } from "lucide-react";
import { SectionLabel } from "@/components/shell/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NETWORK } from "@/lib/sample";

const ROWS = [
  { title: "Security", hint: "Passkeys, session lock, Face ID per trade", stage: "S6" },
  { title: "Recovery", hint: "Export recovery phrase (step-up)", stage: "S6" },
  { title: "Notifications", hint: "Fills, liquidation, deposits, card", stage: "S11" },
  { title: "Help", hint: "Risk explainer, fees, contact", stage: "S11" },
  { title: "Delete data", hint: "Clear local data and encrypted prefs", stage: "S6" },
] as const;

/** Account (plan §2.4 Screens). Rows are placeholders until their owning stage lands. */
export function AccountScreen() {
  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <SectionLabel>Account</SectionLabel>
      <div className="mx-4 border border-border">
        <div className="flex items-center justify-between border-border border-b px-3 py-3">
          <div>
            <p className="font-mono text-caption">NETWORK MODE</p>
            <p className="text-caption text-muted-foreground">Practice uses testnet funds; mainnet is real money.</p>
          </div>
          <span className="rounded-xs border border-primary/50 px-1.5 py-0.5 font-mono text-micro text-primary">
            {NETWORK.mode}
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
      <SectionLabel>Settings</SectionLabel>
      <ul className="mx-4 border border-border">
        {ROWS.map((r) => (
          <li
            key={r.title}
            className="flex items-center justify-between border-border border-b px-3 py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-mono text-caption">{r.title.toUpperCase()}</p>
              <p className="truncate text-caption text-muted-foreground">{r.hint}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 font-mono text-micro text-muted-foreground">
              {r.stage}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
