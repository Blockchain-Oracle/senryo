// The app shell (Mitoshi S22 `AppShell.tsx`, ported from Baku/roy-chain's Slush-measured structure; D-189): a floating
// rail, the top line, ONE bordered stage holding the page; under 768 px the rail hides, the top line carries the seal
// and the dock sits at the bottom. The frame is static; everything that reads the path, the account or the stream is a
// client island inside it. The terminal takes the whole stage (`.terminal-surface`, no top line or dock).
import type { ReactNode } from "react";
import { ConfettiHost } from "./ConfettiHost";
import { BalanceChip, ModeCapsule } from "./chips";
import { DrawerHost } from "./DrawerHost";
import { LiveHost } from "./LiveHost";
import { MobileDock } from "./MobileDock";
import { Rail } from "./Rail";
import { ResultHost } from "./ResultHost";
import { ToasterHost } from "./ToasterHost";
import { TopLine } from "./TopLine";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Rail
        foot={
          <>
            <ModeCapsule className="rail-mode" />
            <BalanceChip className="rail-balance" />
          </>
        }
      />
      <div className="app-column">
        <TopLine />
        <main id="content" tabIndex={-1} className="app-stage">
          {children}
        </main>
      </div>
      <MobileDock />
      <DrawerHost />
      <LiveHost />
      <ResultHost />
      <ConfettiHost />
      <ToasterHost />
    </div>
  );
}
