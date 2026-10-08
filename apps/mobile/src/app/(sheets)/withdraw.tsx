import { router } from "expo-router";
import { WithdrawSheet } from "~/features/wallet/WithdrawSheet";

/** Withdraw (S5.12) as a sheet route over whatever opened it, so it measures against the whole screen. */
export default function Withdraw() {
  return <WithdrawSheet onClose={() => router.back()} />;
}
