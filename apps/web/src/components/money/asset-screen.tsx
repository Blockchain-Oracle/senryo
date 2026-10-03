"use client";

/**
 * Asset detail, any asset (flow book B2; plan §0.9 "Asset detail"): the mark, name and verified state; the price and
 * 24 h change where one is served (Mainnet); your balance with the dollar assets' breakdown (wallet / in trades); the
 * action circles Receive · Send · Withdraw · Swap (Swap is Mainnet-only, locked with that reason in Practice, as on the
 * phone); the own ↔ trade cross-link; and, for an unverified token, the banner and Hide.
 */
import { ArrowDownLeft, ArrowUpRight, Repeat, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ActionCircle, ActionCircles } from "@/components/kit/action-circle";
import { AmountHero } from "@/components/kit/amount-hero";
import { DetailRow, ListRow, QuietLine } from "@/components/kit/list-row";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_HERO } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import { amountOf, changeText, tokenPrice } from "@/lib/money/format";
import { useHiddenTokens } from "@/lib/money/hidden";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { AssetMark } from "./asset-mark";

/** Own ↔ trade cross-links (flow book rule 6): the gold token ↔ the XAU perp. */
const PERP_OF: Record<string, string> = { XAUT0: "XAU", XAUT: "XAU" };

export function AssetScreen() {
  const key = (useSearchParams().get("address") ?? "").toLowerCase();
  const address = useAccount().hint?.address;
  const assets = useMoneyAssets(address);
  const hidden = useHiddenTokens(ACTIVE_NETWORK.chainId, address);
  const asset = assets.find(key);
  if (assets.status === "loading")
    return (
      <Column>
        <PageHeader back={ROUTES.home} />
        <Skeleton className="mt-6 h-40 w-full" />
      </Column>
    );
  if (!asset)
    return (
      <Column>
        <PageHeader back={ROUTES.home} />
        <QuietLine action={{ label: "Receive", href: ROUTES.receive }}>Not in this account</QuietLine>
      </Column>
    );
  const practice = ACTIVE_NETWORK.key === "testnet";
  const change = changeText(asset.change24hBps);
  const perp = PERP_OF[asset.symbol.toUpperCase()];
  const send = `${ROUTES.send}?asset=${asset.key}`;
  const withdraw = `${ROUTES.withdraw}?asset=${asset.key}`;
  return (
    <Column>
      <PageHeader title={asset.symbol} back={ROUTES.home} />
      <div className="grid justify-items-center gap-2 pt-2 text-center">
        <AssetMark asset={asset} size={MARK_HERO} />
        <p className="text-row">
          {asset.name}
          {asset.verified ? null : (
            <span className="ml-2 rounded-xs bg-warning-surface px-1.5 text-label text-warn">Unverified</span>
          )}
        </p>
        {asset.valueUsd6 !== null ? (
          <AmountHero text={money(asset.valueUsd6)} />
        ) : (
          <p className="text-row text-text-3">No price</p>
        )}
        <p className="text-meta text-text-2 tnum">
          {amountOf(asset, asset.total)}
          {asset.priceUsd18 !== null ? ` · ${tokenPrice(asset.priceUsd18)}` : ""}
          {change ? ` · ${change} 24h` : ""}
        </p>
      </div>
      <ActionCircles className="pt-6">
        <ActionCircle icon={<ArrowDownLeft />} label="Receive" href={ROUTES.receive} />
        <ActionCircle icon={<Send />} label="Send" href={send} />
        <ActionCircle icon={<ArrowUpRight />} label="Withdraw" href={withdraw} />
        <ActionCircle
          icon={<Repeat />}
          label="Swap"
          {...(practice ? { locked: "Mainnet only" } : { href: `${ROUTES.swap}?pay=${asset.key}` })}
        />
      </ActionCircles>
      {!asset.verified ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-md bg-warning-surface px-4 py-3">
          <p className="text-meta text-warn">
            {asset.lookalike ? `Not the listed ${asset.symbol}` : "Not on the token list"}
          </p>
          <Button size="sm" variant="outline" onClick={() => hidden.hide(asset.key)}>
            Hide
          </Button>
        </div>
      ) : null}
      <section className="mt-6 grid">
        <h2 className="text-section-title">Your balance</h2>
        <DetailRow label="Wallet" value={amountOf(asset, asset.wallet)} />
        {asset.collateral ? <DetailRow label="In trades" value={amountOf(asset, asset.trading)} /> : null}
        {asset.collateral && asset.trading > asset.tradingFree ? (
          <DetailRow label="Held by positions" value={amountOf(asset, asset.trading - asset.tradingFree)} />
        ) : null}
      </section>
      {perp ? (
        <ListRow className="mt-4" title={`Trade ${perp} with leverage`} value="›" href={ROUTES.trade(perp)} />
      ) : null}
    </Column>
  );
}
