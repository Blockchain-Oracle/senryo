/**
 * The five assets that cross into (and out of) Monad by bridge (routes.md §3/§4, `BRIDGE_ASSETS`), with the identity
 * each shows. Marks are the Mainnet entities: Practice's testnet USDC is the same asset identity (Circle's USDC), and
 * every other Practice row is locked "Mainnet only" (only CCTP serves the test network).
 */
import { BRIDGE_ASSETS } from "@senryo/api-client";
import {
  type BridgeAsset,
  type ChainId,
  MAINNET_CHAIN_ID,
  MAINNET_TOKENS,
  MONAD_BRIDGE_ASSETS,
  SPOT_TOKENS,
} from "@senryo/config";
import { collateralId, EXTERNAL_CHAIN_IDS, entity, ids } from "@senryo/identity";

const NAME: Record<BridgeAsset, string> = {
  MON: "Monad",
  USDC: "USD Coin",
  AUSD: "Agora USD",
  USDT0: "USDT0",
  XAUt0: "Tether Gold",
};

export function bridgeAssetMark(asset: BridgeAsset): string {
  switch (asset) {
    case "MON":
      return ids.native(MAINNET_CHAIN_ID, "MON");
    case "USDC":
      return collateralId(MAINNET_CHAIN_ID, "USDC");
    case "AUSD":
      return collateralId(MAINNET_CHAIN_ID, "AUSD");
    case "USDT0":
      return ids.token(MAINNET_CHAIN_ID, MAINNET_TOKENS.usdt0);
    case "XAUt0":
      return ids.token(MAINNET_CHAIN_ID, MAINNET_TOKENS.xaut0);
  }
}

export function bridgeAssetName(asset: BridgeAsset): string {
  return entity(bridgeAssetMark(asset))?.name ?? NAME[asset];
}

export function isBridgeAsset(value: string | undefined): value is BridgeAsset {
  return value !== undefined && (BRIDGE_ASSETS as readonly string[]).includes(value);
}

/** The assets this network bridges, in the product's order, each with whether it is served here. */
export function bridgeAssetsOn(chainId: ChainId): { asset: BridgeAsset; served: boolean }[] {
  const book = MONAD_BRIDGE_ASSETS[chainId] ?? {};
  return BRIDGE_ASSETS.map((asset) => ({ asset, served: book[asset] !== undefined }));
}

/** Tokens that arrive as USDC and are swapped here (no direct route in): ETH and WBTC. */
export const ARRIVE_AS_USDC = [
  { symbol: "ETH", name: "Ether", mark: ids.native(EXTERNAL_CHAIN_IDS.ethereum, "ETH") },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    mark: SPOT_TOKENS.find((t) => t.symbol === "WBTC")?.mark ?? ids.token(MAINNET_CHAIN_ID, "0x"),
  },
] as const;
