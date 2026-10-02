"use client";

/**
 * The feed (flow book F4; Fomo F15): Global · Following underline tabs over trade events and theses, newest first,
 * page by page. Following needs an api session — while trading is locked it waits for the person's click (one passkey
 * prompt) instead of raising one on its own. `actor` narrows it to one trader (a profile's Trades tab).
 */
import type { FeedScope } from "@senryo/api-client";
import { useFeed } from "@senryo/query";
import { useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { QuietLine } from "@/components/kit/list-row";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { Tabs } from "@/components/ui/vercel-tabs";
import { ROUTES } from "@/lib/constants/routes";
import { useSessionGate } from "@/lib/social/session-gate";
import { FeedRow } from "./feed-row";

function FeedList({ scope, actor }: { scope: FeedScope; actor?: string | undefined }) {
  const feed = useFeed(scope, undefined, actor);
  const items = known(feed.reading);
  if (!items) {
    if (feed.reading.status === "failed") return <QuietLine>Couldn’t load the feed</QuietLine>;
    return <RowsSkeleton />;
  }
  if (items.length === 0)
    return scope === "friends" ? (
      <QuietLine>Nothing from people you follow yet</QuietLine>
    ) : (
      <QuietLine action={{ label: "Markets", href: ROUTES.markets }}>No activity yet</QuietLine>
    );
  return (
    <div>
      {items.map((item) => (
        <FeedRow key={item.id} item={item} />
      ))}
      {feed.hasMore ? (
        <Button variant="ghost" className="w-full font-sans" disabled={feed.loadingMore} onClick={feed.loadMore}>
          {feed.loadingMore ? "Loading…" : "More"}
        </Button>
      ) : null}
    </div>
  );
}

function FollowingFeed() {
  const gate = useSessionGate();
  if (gate.status === "guest")
    return (
      <QuietLine action={{ label: "Create account", href: ROUTES.welcome }}>Follow traders to see them here</QuietLine>
    );
  if (gate.status === "locked" || gate.status === "failed")
    return <QuietLine action={{ label: "Unlock", onClick: gate.open }}>Following needs your session</QuietLine>;
  if (gate.status === "pending") return <RowsSkeleton />;
  return <FeedList scope="friends" />;
}

export function Feed() {
  const [tab, setTab] = useState<"global" | "friends">("global");
  return (
    <section>
      <Tabs
        tabs={[
          { id: "global", label: "Global" },
          { id: "friends", label: "Following" },
        ]}
        activeTab={tab}
        label="Feed"
        onTabChange={(id) => setTab(id === "friends" ? "friends" : "global")}
      />
      <div className="pt-2">{tab === "global" ? <FeedList scope="global" /> : <FollowingFeed />}</div>
    </section>
  );
}

/** One trader's trades and theses (a profile's Trades tab). */
export function ActorFeed({ address }: { address: string }) {
  return <FeedList scope="global" actor={address} />;
}
