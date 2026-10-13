/**
 * "Open positions" over the terminal (Tradash's phone sheet, R5.3; D-343): the live list, resting at 62 / 88 / 100 %
 * like the market sheet (D-321). A tap on a row selects that position on the chart and the sheet slides away.
 */

import { LIST_DETENTS } from "~/components/sheet/constants";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { useTheme } from "~/theme";
import { PositionsList } from "./PositionsList";

function List() {
  const { color } = useTheme();
  const close = useSheetClose();
  return <PositionsList ground={color.popover} onPick={() => close()} />;
}

export function PositionsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} closeLabel="Close open positions" detents={LIST_DETENTS}>
      <SheetHeading title="Open positions" />
      <List />
    </Sheet>
  );
}
