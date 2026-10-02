import { isDeployed } from "@senryo/chain";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { BalanceDetails } from "~/features/portfolio/BalanceDetails";
import { PortfolioDetails } from "~/features/portfolio/PortfolioDetails";
import { useNetwork } from "~/lib/network";

/**
 * Balance details (direction §7): a compact sheet over Home, opened from the availability row. Its heading carries
 * the one thing the three cells cannot say for themselves — that they overlap.
 */
export default function BalanceDetailsSheet() {
  const network = useNetwork();
  return (
    <SheetRoute title="Portfolio details">
      <PortfolioDetails />
      {isDeployed(network.chainId, "SenryoCore") ? <BalanceDetails /> : null}
    </SheetRoute>
  );
}
