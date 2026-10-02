import { MAINNET_CHAIN_ID } from "@senryo/config";
import { spotToken } from "@senryo/query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { assetRoute, ROUTES } from "~/lib/constants/routes";

/**
 * `/markets/tokens/[token]` (J11's symbol route): an asset's page is routed by chain and address now (B2), so the
 * listed token opens `/asset/143/<address>` — the same page Home's Assets rows open, with every action it supports.
 */
export default function TokenPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const spot = spotToken(token ?? "");
  return <Redirect href={spot ? assetRoute(MAINNET_CHAIN_ID, spot.address) : ROUTES.markets} />;
}
