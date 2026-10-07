import { Button } from "~/components/kit/Button";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { FAN_ACTIONS, FAN_LABEL } from "~/components/shell/constants";
import { useFanActions } from "~/components/shell/useFanActions";

/** The old fan's four real operations, now in the source's contextual method sheet. */
export default function TransferSheet() {
  return (
    <SheetRoute title="Move money">
      <Actions />
    </SheetRoute>
  );
}
function Actions() {
  const close = useSheetClose();
  const action = useFanActions();
  return (
    <>
      {FAN_ACTIONS.map((name) => (
        <Button key={name} label={FAN_LABEL[name]} variant="secondary" onPress={() => close(() => action(name))} />
      ))}
    </>
  );
}
