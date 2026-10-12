import { router } from "expo-router";
import { SheetInPlace } from "~/components/sheet/SheetHost";
import { WithdrawSheet } from "~/features/wallet/WithdrawSheet";

/** Withdraw (S5.12) as a sheet route over whatever opened it, so it measures against the whole screen. */
export default function Withdraw() {
  return (
    <SheetInPlace>
      <WithdrawSheet onClose={() => router.back()} />
    </SheetInPlace>
  );
}
