/**
 * A market that doesn't trade here yet, still discoverable (review S03; flow book C1 step 3): the `RowShell` grammar
 * with its real mark (Perpl's badge on crypto), the ticker with a lock and one word, its short name, and the live
 * price and 24 h change from its authoritative source — Perpl's mark price, or a calculated wrapper feed. The row
 * opens its read-only page; long-press stars it (C10). Nothing is invented: a price that can't be read shows none.
 */
import type { DiscoveryInstrument, UnpricedInstrument } from "@senryo/config";
import type { Reading } from "@senryo/core";
import { ids } from "@senryo/identity";
import type { DiscoveryQuote } from "@senryo/query";
import { router } from "expo-router";
import { tokenPrice } from "~/features/tokens/format";
import { discoverRoute } from "~/lib/constants/routes";
import { signedPct } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { discoveryMark } from "./discovery-marks";
import { lockWord, NO_FEED } from "./discovery-words";
import { LockTag, RowShell } from "./RowShell";
import { useWatchlist } from "./useWatchlist";

export function DiscoveryRow({
  instrument,
  reading,
}: {
  instrument: DiscoveryInstrument;
  reading: Reading<DiscoveryQuote>;
}) {
  const network = useNetwork();
  const watchlist = useWatchlist();
  const quote = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  const change = quote?.change24h.available ? quote.change24h.value.bps : undefined;
  const word = lockWord(instrument, network.chainId);
  const price = reading.status === "unknown" ? undefined : quote ? tokenPrice(quote.price18) : null;
  const name = instrument.class === "crypto" ? instrument.name : instrument.underlying.name;
  return (
    <RowShell
      mark={discoveryMark(instrument)}
      badge={instrument.class === "crypto" ? ids.venue("perpl") : undefined}
      markLabel={instrument.symbol}
      title={instrument.symbol}
      tag={<LockTag word={word} />}
      subtitle={name}
      price={price}
      changeBps={change}
      onPress={() => router.push(discoverRoute(instrument.id))}
      onLongPress={() => watchlist.toggle(instrument.id)}
      accessibilityLabel={`${instrument.symbol}, ${name}, ${word}${price ? `, ${price}` : ""}${change === undefined ? "" : `, ${change >= 0n ? "up" : "down"} ${signedPct(change)}`}`}
      accessibilityHint="Opens its read-only page. Long-press to star it"
    />
  );
}

/** An instrument with no price feed on Monad (crude oil): its mark, a lock and "No feed", and no price. */
export function UnpricedRow({ instrument }: { instrument: UnpricedInstrument }) {
  return (
    <RowShell
      mark={ids.equity(instrument.symbol)}
      markLabel={instrument.symbol}
      title={instrument.symbol}
      tag={<LockTag word={NO_FEED} />}
      subtitle={instrument.name}
      price={null}
      changeBps={undefined}
      onPress={() => router.push(discoverRoute(instrument.id))}
      accessibilityLabel={`${instrument.name}, no price feed yet`}
    />
  );
}
