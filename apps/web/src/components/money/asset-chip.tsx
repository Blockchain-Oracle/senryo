"use client";

/**
 * The asset chip (Phantom P20, the phone's `AssetChip`): mark, symbol, ⌄ — opens the asset picker. Used by the swap
 * plates and the pool's "Pay with". 21st was searched first ("payment method selector pay with token": card-number
 * and checkbox payment forms, none fit an asset chip).
 */
import { ChevronDown } from "lucide-react";
import type { MoneyAsset } from "@/lib/money/assets";
import { cn } from "@/lib/utils";
import { AssetMark } from "./asset-mark";

const MARK_CHIP = 28;

export function AssetChip({
  asset,
  onClick,
  label,
  className,
}: {
  asset: MoneyAsset | undefined;
  onClick: () => void;
  /** What the chip chooses ("Pay with"), for the accessible name. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `${label} ${asset?.symbol ?? "Choose"}` : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full bg-raised-2 py-1.5 pr-3 pl-1.5 text-row hover:bg-row-pressed",
        className,
      )}
    >
      {asset ? <AssetMark asset={asset} size={MARK_CHIP} /> : null}
      {asset?.symbol ?? "Choose"}
      <ChevronDown className="size-4 text-text-2" aria-hidden />
    </button>
  );
}
