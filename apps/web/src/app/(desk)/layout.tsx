import type { ReactNode } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { DeskDataProvider } from "@/lib/market-data";

/**
 * The desk: D2 top strip + tabs over every signed-in surface, with the query layer's clients (chain reads, indexer,
 * engine socket) mounted here only. Phone widths render the D2 column 1:1; tablets centre that column; ≥1024 each
 * screen spreads into its desk columns.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <DeskDataProvider>
      <div className="flex min-h-dvh flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-2xl flex-1 pb-10 lg:max-w-screen-2xl lg:px-4">{children}</main>
      </div>
    </DeskDataProvider>
  );
}
