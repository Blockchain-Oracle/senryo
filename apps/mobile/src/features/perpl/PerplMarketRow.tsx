/**
 * A Perpl crypto market in the Markets list (flow book C1 steps 2–3): the `RowShell` grammar — the market's mark with
 * Perpl's badge, the ticker with its live maximum leverage on Mainnet ("15×") or a lock and one word where it can't be
 * traded ("Mainnet" in Practice, "Read-only" in Perpl's restricted regions, "Paused"), its name, and Perpl's mark price
 * over the 24 h change. The row opens the market's page; long-press stars it (C10). A price that can't be read shows
 * none.
 */
import type { PerplInstrument } from "@senryo/config";
import type { Reading } from "@senryo/core";
import { type DiscoveryQuote, usePerplLeverageCaps } from "@senryo/query";
import { router } from "expo-router";
import { LeverageBadge } from "~/features/markets/LeverageBadge";
import { LockTag, RowShell } from "~/features/markets/RowShell";
import { useWatchlist } from "~/features/markets/useWatchlist";
import { tokenPrice } from "~/features/tokens/format";
import { marketRoute } from "~/lib/constants/routes";
import { signedPct } from "~/lib/money";
import { leverageX } from "./format";
import { perplMarketBySymbol } from "./market";
import { usePerplAccess } from "./usePerplAccess";

export function PerplMarketRow({
  instrument,
  reading,
}: {
  instrument: PerplInstrument;
  reading: Reading<DiscoveryQuote>;
}) {
  const watchlist = useWatchlist();
  const access = usePerplAccess();
  const caps = usePerplLeverageCaps();
  const meta = perplMarketBySymbol(instrument.symbol);
  const quote = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  const change = quote?.change24h.available ? quote.change24h.value.bps : undefined;
  const price = reading.status === "unknown" ? undefined : quote ? tokenPrice(quote.price18) : null;
  const cap =
    caps.status === "fresh" || caps.status === "stale"
      ? caps.value[meta?.marketId ?? instrument.perplMarketId]
      : undefined;
  const tag =
    access.state === "locked" ? (
      <LockTag word={access.word} />
    ) : cap !== undefined ? (
      <LeverageBadge x={leverageX(cap)} />
    ) : null;
  const state = access.state === "locked" ? access.word : cap !== undefined ? `up to ${leverageX(cap)} times` : "";
  return (
    <RowShell
      mark={meta?.mark}
      badge={meta?.venueMark}
      markLabel={instrument.symbol}
      title={instrument.symbol}
      tag={tag}
      subtitle={instrument.name}
      price={price}
      changeBps={change}
      onPress={() => router.push(marketRoute(instrument.symbol))}
      onLongPress={() => watchlist.toggle(instrument.id)}
      accessibilityLabel={`${instrument.symbol}, ${instrument.name} on Perpl, ${state}${price ? `, ${price}` : ""}${change === undefined ? "" : `, ${change >= 0n ? "up" : "down"} ${signedPct(change)}`}`}
      accessibilityHint="Opens the market. Long-press to star it"
    />
  );
}
