"use client";

import type { ReactNode } from "react";
import { ListRow } from "@/components/kit/list-row";
import { MARK_ROW } from "@/lib/constants/brand";
import type { MoneyAsset } from "@/lib/money/assets";
import { changeText, holdingLine, valueText } from "@/lib/money/format";
import { AssetMark } from "./asset-mark";

/**
 * One holding (flow book B1 row): mark, name, amount (a dollar asset folds in its trading part), value and 24 h change.
 * Unverified tokens say so in the second line and show no value.
 */
export function AssetRow({
  asset,
  href,
  onClick,
  trailing,
  detail,
}: {
  asset: MoneyAsset;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  trailing?: ReactNode;
  /** Replaces the value column's second line (a picker shows what can move). */
  detail?: string | undefined;
}) {
  const change = changeText(asset.change24hBps);
  const down = asset.change24hBps !== null && asset.change24hBps < 0;
  return (
    <ListRow
      href={href}
      onClick={onClick}
      leading={<AssetMark asset={asset} size={MARK_ROW} />}
      title={asset.name}
      subtitle={holdingLine(asset)}
      value={asset.verified ? valueText(asset) : undefined}
      detail={detail ?? change}
      detailClassName={detail ? "text-text-2" : down ? "text-down" : "text-up"}
      trailing={trailing}
    />
  );
}
