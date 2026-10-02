"use client";

/**
 * Home's body (flow book §0.9 Home): Positions · Assets · Earn as underline tabs instead of stacked boxed sections. The
 * chosen tab is a per-viewer convenience kept in this browser. Every tab has its loading, empty and failed state.
 */
import { ENGINE_MARKETS, engineMarketsOn } from "@senryo/config";
import type { Address } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useAccountRisk, useLpVault, usePositions, useQueryEnv } from "@senryo/query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { AssetRow } from "@/components/money/asset-row";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/vercel-tabs";
import { readJson, writeJson } from "@/lib/account/local";
import { MARK_ROW } from "@/lib/constants/brand";
import { MONEY_STORAGE } from "@/lib/constants/money";
import { assetHref, ROUTES } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import type { MoneyAsset } from "@/lib/money/assets";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { cn } from "@/lib/utils";
import { PositionRow } from "./position-row";

type HomeTab = "positions" | "assets" | "earn";
const TABS = [
  { id: "positions", label: "Positions" },
  { id: "assets", label: "Assets" },
  { id: "earn", label: "Earn" },
] as const;
const LOADING_ROWS = ["a", "b", "c"] as const;
/** Empty positions: the featured markets to start from (flow book Home empty state). */
const FEATURED = ["XAU", "XAG", "EUR"] as const;

function savedTab(): HomeTab {
  const v = readJson(MONEY_STORAGE.homeTab, (raw) => (typeof raw === "string" ? raw : undefined));
  return v === "assets" || v === "earn" ? v : "positions";
}

export function RowsSkeleton() {
  return (
    <div className="grid gap-3 py-2" aria-busy>
      {LOADING_ROWS.map((k) => (
        <div key={k} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** `readOnly` (watch mode): the same tabs for someone else's address, with nothing that acts. */
export function HomeTabs({ address, readOnly = false }: { address: Address; readOnly?: boolean }) {
  const [tab, setTab] = useState<HomeTab>(() => (readOnly ? "positions" : savedTab()));
  return (
    <section className="mt-2">
      <Tabs
        tabs={TABS}
        activeTab={tab}
        label="Home sections"
        onTabChange={(id) => {
          setTab(id as HomeTab);
          if (!readOnly) writeJson(MONEY_STORAGE.homeTab, id);
        }}
      />
      <div key={tab} className="animate-in fade-in pt-2 duration-200">
        {tab === "positions" ? (
          <PositionsTab address={address} readOnly={readOnly} />
        ) : tab === "assets" ? (
          <AssetsTab address={address} readOnly={readOnly} />
        ) : (
          <EarnTab address={address} />
        )}
      </div>
    </section>
  );
}

function PositionsTab({ address, readOnly }: { address: Address; readOnly: boolean }) {
  const env = useQueryEnv();
  const positions = usePositions(address);
  const account = known(useAccountRisk(address, "latest"));
  const rows = known(positions);
  if (!rows) {
    if (positions.status === "failed") return <QuietLine>Couldn’t load positions</QuietLine>;
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    if (readOnly) return <QuietLine>No open positions</QuietLine>;
    const listed = engineMarketsOn(env.chainId).map((m) => m.symbol);
    return (
      <div>
        <QuietLine action={{ label: "Markets", href: ROUTES.markets }}>No positions yet</QuietLine>
        {FEATURED.filter((s) => listed.includes(s)).map((symbol) => {
          const meta = ENGINE_MARKETS.find((m) => m.symbol === symbol);
          if (!meta) return null;
          return (
            <ListRow
              key={symbol}
              href={ROUTES.trade(symbol)}
              leading={<EntityMark id={ids.engineMarket(env.chainId, meta.id)} size={MARK_ROW} decorative />}
              title={symbol}
              subtitle={meta.name}
              value="Trade ›"
            />
          );
        })}
      </div>
    );
  }
  return (
    <div>
      {rows.map((p) => (
        <PositionRow
          key={p.marketId}
          position={p}
          account={account}
          {...(readOnly
            ? { href: ROUTES.trade(ENGINE_MARKETS.find((m) => m.id === p.marketId)?.symbol ?? "XAU") }
            : {})}
        />
      ))}
    </div>
  );
}

function AssetsTab({ address, readOnly }: { address: Address; readOnly: boolean }) {
  const assets = useMoneyAssets(address);
  if (assets.status === "loading") return <RowsSkeleton />;
  if (assets.status === "failed")
    return <QuietLine action={{ label: "Retry", onClick: assets.retry }}>Couldn’t load assets</QuietLine>;
  if (assets.assets.length === 0 && assets.other.length === 0)
    return readOnly ? (
      <QuietLine>No assets</QuietLine>
    ) : (
      <QuietLine action={{ label: "Add money", href: ROUTES.addMoney }}>No assets yet</QuietLine>
    );
  const href = (a: MoneyAsset) => (readOnly ? undefined : assetHref(a.key));
  return (
    <div>
      {assets.stale && assets.error ? <p className="pb-1 text-meta text-warn">Offline</p> : null}
      {assets.assets.map((a) => (
        <AssetRow key={a.key} asset={a} href={href(a)} />
      ))}
      {assets.degraded ? (
        <QuietLine action={{ label: "Retry", onClick: assets.retry }}>Other tokens couldn’t load</QuietLine>
      ) : null}
      <Collapsed label={`Other tokens (${assets.other.length})`} rows={assets.other} href={href} />
    </div>
  );
}

function Collapsed({
  label,
  rows,
  href,
}: {
  label: string;
  rows: readonly MoneyAsset[];
  href: (a: MoneyAsset) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 py-2 text-meta text-text-2 hover:text-foreground"
      >
        {label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? rows.map((a) => <AssetRow key={a.key} asset={a} href={href(a)} />) : null}
    </div>
  );
}

function EarnTab({ address }: { address: Address }) {
  const vault = useLpVault(address);
  const value = known(vault);
  if (!value) {
    if (vault.status === "failed") return <QuietLine>Couldn’t load the pool</QuietLine>;
    return <RowsSkeleton />;
  }
  const invested = value.sharesValue + value.pendingValue;
  if (invested === 0n)
    return <QuietLine action={{ label: "Deposit", href: ROUTES.pool }}>Earn from the pool</QuietLine>;
  return (
    <ListRow
      href={ROUTES.pool}
      leading={<EntityMark id={ids.venue("senryo")} size={MARK_ROW} decorative />}
      title="Senryo pool"
      subtitle={value.pending.length > 0 ? "Redemption pending" : "Earns from trading"}
      value={money(invested)}
    />
  );
}
