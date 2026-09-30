import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function RiskExplainerSheet() {
  return (
    <SheetRoute
      title="Before your first leveraged trade"
      body="Perps are cash-settled: you never own the gold. Leverage multiplies gains and losses, and a position is liquidated if its margin runs out. Shown once, before your first trade."
    />
  );
}
