/**
 * "Open positions" over the terminal (Tradash's phone sheet, R5.3): the live list with its Unrealized card, resting
 * at 62 / 88 / 100 % like the market sheet (D-321).
 */

import { LIST_DETENTS } from "~/components/sheet/constants";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { PositionsList } from "./PositionsList";

export function PositionsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} closeLabel="Close open positions" detents={LIST_DETENTS}>
      <SheetHeading title="Open positions" />
      <PositionsList />
    </Sheet>
  );
}
