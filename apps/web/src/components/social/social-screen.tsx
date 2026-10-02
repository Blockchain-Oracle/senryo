"use client";

/**
 * Social (flow book F1, F4; the phone's Social tab): Feed · Leaderboard. The board ranks realized P&L after fees,
 * funding and borrow for 24h · 7d · 30d · All, with the anti-farming floor; a row opens the trader, with Follow.
 */
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useLeaderboard, useQueryEnv } from "@senryo/query";
import { useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { Avatar } from "@/components/identity/avatar";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { TabTitle } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { known } from "@/components/ui/reading";
import { Tabs } from "@/components/ui/vercel-tabs";
import { MARK_ROW } from "@/lib/constants/brand";
import { watchHref } from "@/lib/constants/routes";
import { signedMoneyOn } from "@/lib/format";
import { handleOf, nameOf } from "@/lib/social/format";
import { Feed } from "./feed";
import { PeriodChips } from "./standing";

function Leaderboard() {
  const env = useQueryEnv();
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const board = useLeaderboard(period);
  const value = known(board);
  return (
    <div className="grid gap-2">
      <PeriodChips value={period} onChange={setPeriod} />
      {!value ? (
        board.status === "failed" ? (
          <QuietLine>Board not ready yet</QuietLine>
        ) : (
          <RowsSkeleton />
        )
      ) : value.entries.length === 0 ? (
        <QuietLine>No ranked traders yet</QuietLine>
      ) : (
        <div>
          {value.entries.map((e) => (
            <ListRow
              key={e.address}
              href={watchHref(e.address, env.chainId)}
              leading={
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right text-meta text-text-3 tnum">{e.rank}</span>
                  <Avatar avatar={e.avatar} address={e.address} size={MARK_ROW} />
                </span>
              }
              title={nameOf(e)}
              subtitle={`${handleOf(e)} · ${e.trades} ${e.trades === 1 ? "trade" : "trades"}`}
              value={
                <span className={e.netPnlUsd6 < 0n ? "text-down" : "text-up"}>
                  {signedMoneyOn(env.chainId, e.netPnlUsd6)}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SocialScreen() {
  const [tab, setTab] = useState<"feed" | "board">("feed");
  return (
    <Column className="grid gap-3">
      <TabTitle>Social</TabTitle>
      <Tabs
        tabs={[
          { id: "feed", label: "Feed" },
          { id: "board", label: "Leaderboard" },
        ]}
        activeTab={tab}
        label="Social"
        onTabChange={(id) => setTab(id === "board" ? "board" : "feed")}
      />
      {tab === "feed" ? <Feed /> : <Leaderboard />}
    </Column>
  );
}
