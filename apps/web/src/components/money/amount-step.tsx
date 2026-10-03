"use client";

/**
 * The amount step of a move (flow book B7 step 2 / B8 step 3, B0.2): the asset chip ("AUSD ⌄", any holding), the exact
 * amount in the asset's own decimals, Available with Max (MON keeping its fee reserve), the part locked in trades with
 * the path that frees it, the recipient's warnings, and Review once nothing stops it.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { plainAmount } from "@/lib/money/amount";
import { type MoneyAsset, spendableOf } from "@/lib/money/assets";
import { amountOf } from "@/lib/money/format";
import { AssetMark } from "./asset-mark";

const MARK_PICK = 28;

export function AmountStep({
  asset,
  warnings,
  checking,
  blocked,
  prefill,
  onAsset,
  onReview,
}: {
  asset: MoneyAsset;
  warnings: readonly string[];
  checking: boolean;
  blocked: string | undefined;
  /** A scanned payment code's exact amount (raw units). */
  prefill?: bigint | undefined;
  onAsset: () => void;
  onReview: (amount: bigint) => void;
}) {
  const [text, setText] = useState(() => (prefill && prefill > 0n ? plainAmount(prefill, asset.decimals) : ""));
  const available = spendableOf(asset);
  const parsed = parseUnits(text === "" ? "0" : text, asset.decimals);
  const amount = parsed.ok ? parsed.value : 0n;
  const locked = asset.trading - asset.tradingFree;
  const over = amount > available;
  const problem = blocked ?? (checking ? "Checking the address" : over ? "More than available" : undefined);
  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={onAsset}
        className="mx-auto flex items-center gap-2 rounded-full bg-raised-2 py-1.5 pr-3 pl-1.5 text-row hover:bg-row-pressed"
      >
        <AssetMark asset={asset} size={MARK_PICK} />
        {asset.symbol}
        <ChevronDown className="size-4 text-text-2" aria-hidden />
      </button>
      <div className="grid justify-items-center gap-1">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label={`Amount in ${asset.symbol}`}
          value={text}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.]/g, "");
            if (parseUnits(next === "" ? "0" : next, asset.decimals).ok || next.endsWith(".")) setText(next);
          }}
          className="w-full bg-transparent text-center font-display text-display-margin outline-none tnum placeholder:text-text-3"
        />
        <p className="text-meta text-text-2">
          Available {amountOf(asset, available)}
          <button
            type="button"
            onClick={() => setText(formatUnits(available, asset.decimals, asset.decimals, { grouping: false }))}
            className="ml-2 text-link hover:underline"
          >
            Max
          </button>
        </p>
        {locked > 0n ? (
          <Link href={ROUTES.home} className="text-meta text-text-3 hover:underline">
            {amountOf(asset, locked)} in trades ›
          </Link>
        ) : null}
        {asset.native ? <p className="text-meta text-text-3">Keeps 10 MON for fees</p> : null}
      </div>
      {warnings.map((w) => (
        <p key={w} className="text-center text-meta text-warn">
          {w}
        </p>
      ))}
      {problem && amount > 0n ? <p className="text-center text-meta text-down">{problem}</p> : null}
      <Button size="xl" disabled={amount === 0n || problem !== undefined} onClick={() => onReview(amount)}>
        Review
      </Button>
    </div>
  );
}
