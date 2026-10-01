import { engineMarket } from "@senryo/config";
import { router, useLocalSearchParams } from "expo-router";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { AlertEditor } from "~/features/markets/AlertEditor";
import { ALERT_SHEET_MAX_HEIGHT } from "~/features/markets/constants";
import { DEFAULT_MARKET, ROUTES } from "~/lib/constants/routes";

/**
 * `/markets/[market]/alert` — the price-alert editor for one market, a compact sheet over market detail (J3; opened by
 * the detail header's alert utility). "All alerts" slides the sheet away and then opens the list.
 */
export default function MarketAlert() {
  const { market } = useLocalSearchParams<{ market: string }>();
  const meta = engineMarket((market ?? DEFAULT_MARKET).toUpperCase());
  // Market detail hides the dock while it is focused; this sheet takes the focus, so it holds the dock hidden too.
  useHideDockWhileFocused("market-alert");
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close price alert" maxHeight={ALERT_SHEET_MAX_HEIGHT}>
      {meta ? (
        <Editor marketId={meta.id} />
      ) : (
        <SheetHeading title="Price alert" body="This market isn't available here." />
      )}
    </Sheet>
  );
}

function Editor({ marketId }: { marketId: number }) {
  const close = useSheetClose();
  return <AlertEditor marketId={marketId} onSeeAll={() => close(() => router.push(ROUTES.alerts))} />;
}
