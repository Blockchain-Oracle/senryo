"use client";

import { hasArt } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";

export interface MarkSource {
  mark: string;
  symbol: string;
  logoUrl: string | null;
}

/**
 * An asset's real mark (rule 7, the phone's `AssetMark`): the registry's own art when it has it, else the token list's
 * (or GeckoTerminal's) logo as a disc, else the labelled monogram an unknown token gets — never a dot or a guess.
 */
export function AssetMark({ asset, size }: { asset: MarkSource; size: number }) {
  if (hasArt(asset.mark) || !asset.logoUrl) {
    return <EntityMark id={asset.mark} label={asset.symbol} size={size} decorative />;
  }
  return (
    <img
      src={asset.logoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-raised-2 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
