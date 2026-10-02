/**
 * "From another chain" (B4 steps 1–2; Fomo F21's network list): first the asset — the five that bridge into Monad,
 * with ETH and WBTC kept visible as "Arrives as USDC · swap here" — then the source chains that have a live route for
 * it (`/v1/bridge/routes`, direction in), each with its mark, typical time and provider. Practice serves USDC via
 * Circle CCTP from the test networks only; every other row says "Mainnet only".
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import type { BridgeAsset } from "@senryo/config";
import { anyAssetKeys, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { EntityMark } from "~/components/identity/EntityMark";
import { ReadingView } from "~/components/kit/states";
import { SheetRow } from "~/components/sheet/SheetRow";
import { ChainGrid } from "~/features/money/ChainGrid";
import { useNetwork } from "~/lib/network";
import { SIZE } from "~/theme";
import { ARRIVE_AS_USDC, bridgeAssetMark, bridgeAssetName, bridgeAssetsOn } from "./bridge-assets";

export function ChainAssets({ onPick }: { onPick: (asset: BridgeAsset) => void }) {
  const network = useNetwork();
  const rows = bridgeAssetsOn(network.chainId);
  return (
    <>
      {rows.map(({ asset, served }, i) => (
        <SheetRow
          key={asset}
          index={i}
          title={bridgeAssetName(asset)}
          detail={served ? asset : "Mainnet only"}
          leading={<EntityMark id={bridgeAssetMark(asset)} label={asset} size={SIZE.markToken} decorative />}
          disabled={!served}
          onPress={() => onPick(asset)}
        />
      ))}
      {ARRIVE_AS_USDC.map((t, i) => (
        <SheetRow
          key={t.symbol}
          index={rows.length + i}
          title={t.name}
          detail="Arrives as USDC · swap here"
          leading={<EntityMark id={t.mark} label={t.symbol} size={SIZE.markToken} decorative />}
          disabled
        />
      ))}
    </>
  );
}

export function ChainSources({ asset, onPick }: { asset: BridgeAsset; onPick: (chain: BridgeRouteChain) => void }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const routes = useBridgeRoutes(asset, "in");
  const retry = () => void client.invalidateQueries({ queryKey: anyAssetKeys.bridgeRoutes(env.chainId, asset, "in") });
  return (
    <ReadingView reading={routes} loading="list" loadingLabel="Finding routes" retry={retry}>
      {(value) => <ChainGrid routes={value} onPick={onPick} direction="in" />}
    </ReadingView>
  );
}
