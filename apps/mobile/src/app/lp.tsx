import { ShellScreen } from "~/components/shell/ShellScreen";

export default function LiquiditypoolScreen() {
  return (
    <ShellScreen
      title="Liquidity pool"
      why="The LP pool opens with the engine"
      detail="APR is shown from historical fees, never promised, with utilisation and redeem delay explained."
    />
  );
}
