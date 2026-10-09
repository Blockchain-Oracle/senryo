import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { AppProviders } from "./providers";
import "@/styles/app-shell.css";
import "@/styles/shell-parts.css";
import "@/styles/drawer.css";
import "@/styles/command.css";

export const metadata: Metadata = {
  title: { default: "Senryo", template: "%s · Senryo" },
  description: "Call the next move: Up or Down on live prices, paid out on Monad.",
};

/** `/app` (pivot S6): the S22 shell around every app page, inside the app's clients. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
