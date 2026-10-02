import { router } from "expo-router";
import { Sheet } from "~/components/sheet/Sheet";
import { BalanceDetails } from "~/features/portfolio/BalanceDetails";

/**
 * The Balance sheet (flow book B16): a compact sheet over Home, opened from the hero — the Total and the parts that
 * make it up, each opening its surface.
 */
export default function BalanceDetailsSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close balance">
      <BalanceDetails />
    </Sheet>
  );
}
