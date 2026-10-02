import type { ReactNode } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { DeskDataProvider } from "@/lib/market-data";

/**
 * The app shell: the top strip with the five destinations over every surface, with the query layer's clients (chain
 * reads, indexer, engine socket) mounted here only. Each page reads as the phone's column (`Column`); the trade page
 * spreads into two columns at ≥1024.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <DeskDataProvider>
      <div className="flex min-h-dvh flex-col">
        <TopBar />
        <main className="w-full flex-1">{children}</main>
      </div>
    </DeskDataProvider>
  );
}
