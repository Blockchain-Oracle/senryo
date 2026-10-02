import { useLocalSearchParams } from "expo-router";
import { AssetDetail } from "~/features/asset/AssetDetail";

/** `/asset/[chainId]/[address]` — one page per asset, by chain and contract (native MON = `0x000…000`; B2). */
export default function AssetPage() {
  const { chainId, address } = useLocalSearchParams<{ chainId: string; address: string }>();
  return <AssetDetail chainId={Number.parseInt(chainId ?? "0", 10)} address={(address ?? "").toLowerCase()} />;
}
