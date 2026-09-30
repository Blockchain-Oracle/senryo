import { ShellScreen } from "~/components/shell/ShellScreen";

export default function SwapScreen() {
  return (
    <ShellScreen
      title="Swap"
      why="USDC ↔ AUSD swaps arrive with funding"
      detail="Quotes come from the Uniswap v4 AUSD/USDC pool, with the minimum received shown before you hold to confirm."
    />
  );
}
