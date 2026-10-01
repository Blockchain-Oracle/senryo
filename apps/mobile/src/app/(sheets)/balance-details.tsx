import { SheetRoute } from "~/components/sheet/SheetRoute";
import { BalanceDetails } from "~/features/portfolio/BalanceDetails";

/**
 * Balance details (direction §7): a compact sheet over Home, opened from the availability row. Its heading carries
 * the one thing the three cells cannot say for themselves — that they overlap.
 */
export default function BalanceDetailsSheet() {
  return (
    <SheetRoute title="Balance details" body="Three views of one balance. They overlap, so they don’t add up.">
      <BalanceDetails />
    </SheetRoute>
  );
}
