"use client";

/**
 * Any holding, any action (flow book rule 1; the phone's AssetPicker, Fomo F22): every holding with its mark, amount
 * and value, searchable by symbol, name or pasted address; an asset that can't be used here stays listed, disabled,
 * with ≤ 4 words why. "Other tokens" (unverified) sit under the verified ones.
 */
import { Search } from "lucide-react";
import { useState } from "react";
import { QuietLine } from "@/components/kit/list-row";
import { Input } from "@/components/ui/input";
import { type MoneyAsset, matchesQuery } from "@/lib/money/assets";
import { cn } from "@/lib/utils";
import { AssetRow } from "./asset-row";

export function AssetPicker({
  assets,
  other,
  selectedKey,
  reasonFor,
  detailFor,
  onPick,
}: {
  assets: readonly MoneyAsset[];
  other: readonly MoneyAsset[];
  selectedKey: string | undefined;
  reasonFor: (a: MoneyAsset) => string | undefined;
  detailFor: (a: MoneyAsset) => string;
  onPick: (a: MoneyAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const rows = [...assets, ...other].filter((a) => matchesQuery(a, query));
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets"
          aria-label="Search assets"
          className="pl-9"
        />
      </div>
      {rows.length === 0 ? <QuietLine>No match</QuietLine> : null}
      {rows.map((a) => {
        const reason = reasonFor(a);
        return (
          <div
            key={a.key}
            className={cn(reason && "opacity-50", a.key === selectedKey && "rounded-md bg-selected-row")}
          >
            <AssetRow asset={a} detail={reason ?? detailFor(a)} {...(reason ? {} : { onClick: () => onPick(a) })} />
          </div>
        );
      })}
    </div>
  );
}
