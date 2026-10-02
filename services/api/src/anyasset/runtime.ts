/**
 * The any-asset services (D6 holdings + swap quotes, D2 bridges), built once in main.ts. Reads use the api's own
 * chain clients where it serves that network, else a read client made on first use (holdings and swaps read mainnet
 * whether or not SenryoCore is deployed there).
 */
import { createReadClient, type ReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Logger } from "@senryo/service-common";
import type { ChainContext } from "../context.ts";
import type { ApiSecrets } from "../env.ts";
import { AuroraWatcher } from "./bridge/aurora.ts";
import { BridgeService } from "./bridge/service.ts";
import { GeckoTerminal } from "./gecko.ts";
import { HoldingsService } from "./holdings.ts";
import { HyperSyncScanner } from "./hypersync.ts";
import { ReferencePrices } from "./reference.ts";
import { SwapQuoteService } from "./swap-quote.ts";
import { TokenListService } from "./token-list.ts";

export interface AnyAssetServices {
  holdings: HoldingsService;
  swaps: SwapQuoteService;
  bridges: BridgeService;
  aurora: AuroraWatcher;
}

export function createAnyAsset(
  log: Logger,
  chains: ReadonlyMap<ChainId, ChainContext>,
  secrets: Pick<ApiSecrets, "hypersyncToken" | "alchemyKey" | "auroraKey"> & Partial<Pick<ApiSecrets, "relayKey">>,
  options: { hypersyncPagesPerScan?: number } = {},
): AnyAssetServices {
  const own = new Map<ChainId, ReadClient>();
  const read = (chainId: ChainId): ReadClient => {
    const served = chains.get(chainId)?.read;
    if (served) return served;
    let client = own.get(chainId);
    if (!client) {
      client = createReadClient(chainId);
      own.set(chainId, client);
    }
    return client;
  };
  const tokenList = new TokenListService(log);
  const gecko = new GeckoTerminal(log);
  const aurora = new AuroraWatcher(secrets.auroraKey, log);
  if (!secrets.hypersyncToken)
    log.warn("HYPERSYNC_API_TOKEN unset — holdings discover tokens from the token list only");
  return {
    holdings: new HoldingsService({
      log,
      read,
      tokenList,
      hypersync: new HyperSyncScanner(secrets.hypersyncToken, options.hypersyncPagesPerScan),
      gecko,
      alchemyKey: secrets.alchemyKey,
    }),
    swaps: new SwapQuoteService({ log, read, tokenList, reference: new ReferencePrices(read, gecko, log) }),
    bridges: new BridgeService(log, aurora, secrets.relayKey),
    aurora,
  };
}
