import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { NetworkPicker } from "~/features/network/NetworkPicker";

/** The mode capsule's selector (S8.22): Practice · Paper money / Mainnet · Real money. */
export default function NetworkSheet() {
  return (
    <SheetRoute title="Choose your money" body="Practice with paper money, or trade real funds on Monad.">
      <Picker />
    </SheetRoute>
  );
}

function Picker() {
  const close = useSheetClose();
  return <NetworkPicker onDone={() => close()} />;
}
