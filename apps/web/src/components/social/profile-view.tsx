"use client";

/**
 * A trader's profile (flow book F2; Fomo F16, the phone's TraderProfile): who they are, the period hero, then
 * Positions · Trades — positions read from the chain while they share this network's trades (each opens its market,
 * with Trade this), and their trades and theses as feed rows. A profile is served per network: unlisted and unknown
 * both answer 404, and the page says "Not public on Practice" with the explorer. Nothing here moves money.
 */
import type { PublicProfile } from "@senryo/api-client";
import { isDeployed } from "@senryo/chain";
import { ENGINE_MARKETS, explorerAddressUrl, networkOf } from "@senryo/config";
import { socialKeys, useAccountRisk, usePositions, useProfile, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { PositionRow } from "@/components/home/position-row";
import { Avatar } from "@/components/identity/avatar";
import { QuietLine } from "@/components/kit/list-row";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/vercel-tabs";
import { ROUTES } from "@/lib/constants/routes";
import { isNotFound } from "@/lib/social/format";
import { ActorFeed } from "./feed";
import { ProfileHeader, ShareProfile } from "./profile-header";
import { Standing } from "./standing";

const PROFILE_AVATAR = 64;

function TraderPositions({ address, shared }: { address: `0x${string}`; shared: boolean }) {
  const env = useQueryEnv();
  const live = isDeployed(env.chainId, "SenryoCore");
  const positions = usePositions(shared && live ? address : undefined);
  const account = known(useAccountRisk(shared && live ? address : undefined, "latest"));
  if (!shared) return <QuietLine>Trades private on {networkOf(env.chainId).modeLabel}</QuietLine>;
  if (!live) return <QuietLine>Trading opens soon</QuietLine>;
  const rows = known(positions);
  if (!rows) return positions.status === "failed" ? <QuietLine>Couldn’t load positions</QuietLine> : <RowsSkeleton />;
  if (rows.length === 0) return <QuietLine>No open positions</QuietLine>;
  return (
    <div>
      {rows.map((p) => {
        const symbol = ENGINE_MARKETS.find((m) => m.id === p.marketId)?.symbol ?? "XAU";
        return <PositionRow key={p.marketId} position={p} account={account} href={ROUTES.trade(symbol)} />;
      })}
    </div>
  );
}

function Loaded({ profile }: { profile: PublicProfile }) {
  const [tab, setTab] = useState<"positions" | "trades">("positions");
  return (
    <div className="grid gap-6">
      <ProfileHeader profile={profile} />
      <Standing address={profile.address} />
      <section>
        <Tabs
          tabs={[
            { id: "positions", label: "Positions" },
            { id: "trades", label: "Trades" },
          ]}
          activeTab={tab}
          label="Their activity"
          onTabChange={(id) => setTab(id === "trades" ? "trades" : "positions")}
        />
        <div className="pt-2">
          {tab === "positions" ? (
            <TraderPositions address={profile.address} shared={profile.publicTrades} />
          ) : (
            <ActorFeed address={profile.address} />
          )}
        </div>
      </section>
    </div>
  );
}

/** Unlisted or unknown on this network: the address, its explorer, and nothing that reads like a profile. */
function NotPublic({ address }: { address: string | undefined }) {
  const env = useQueryEnv();
  const mode = networkOf(env.chainId).modeLabel;
  return (
    <div className="grid gap-3 pt-4">
      {address ? (
        <div className="flex items-start justify-between">
          <Avatar address={address} size={PROFILE_AVATAR} />
          <ShareProfile address={address} chainId={env.chainId} />
        </div>
      ) : null}
      <p className="text-row">Not public on {mode}</p>
      {address ? (
        <a
          href={explorerAddressUrl(env.chainId, address)}
          target="_blank"
          rel="noreferrer"
          className="text-meta text-link hover:underline"
        >
          {mode} explorer ›
        </a>
      ) : null}
    </div>
  );
}

/** `lookup` is an address or a handle; the api resolves either on the scoped network. */
export function ProfileView({ lookup, missing }: { lookup: string; missing?: ReactNode }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const reading = useProfile(lookup);
  const profile = known(reading);
  if (profile) return <Loaded profile={profile} />;
  if (reading.status === "failed") {
    const error = client.getQueryState(socialKeys.profile(env.chainId, lookup))?.error;
    if (isNotFound(error)) return missing ?? <NotPublic address={lookup.startsWith("0x") ? lookup : undefined} />;
    return (
      <QuietLine
        action={{
          label: "Retry",
          onClick: () => void client.invalidateQueries({ queryKey: socialKeys.profile(env.chainId, lookup) }),
        }}
      >
        Couldn’t load this profile
      </QuietLine>
    );
  }
  return (
    <div className="grid gap-3 pt-4">
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-12 w-56" />
    </div>
  );
}
