import { type DiscoveryInstrument, MAINNET_CHAIN_ID } from "@senryo/config";
import { ids, perplMarketId } from "@senryo/identity";

/** A read-only instrument's real mark: Perpl's market identity, or the underlying company/fund (never the wrapper's art). */
export function discoveryMark(instrument: DiscoveryInstrument): string {
  return instrument.class === "crypto"
    ? (perplMarketId(MAINNET_CHAIN_ID, instrument.symbol) ?? ids.equity(instrument.symbol))
    : ids.equity(instrument.underlying.ticker);
}
