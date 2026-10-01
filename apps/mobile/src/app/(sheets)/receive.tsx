import { router } from "expo-router";
import { Button } from "~/components/kit/Button";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { MonadInbox } from "~/features/fund/MonadInbox";
import { fundQrRoute } from "~/lib/constants/routes";

/**
 * The fan's Receive (FT057, P21; Codex S1b.7 consult #8): a compact QR sheet over the page under the fan, built on the
 * existing Monad inbox read (the address always comes from the app's own `inboxOf`, D-230). "Deposit details" opens
 * the full page; dismissing restores the page under the fan (FT061).
 */
export default function ReceiveSheet() {
  return (
    <SheetRoute title="Receive" body="Your own Senryo deposit address on Monad.">
      <MonadInbox compact />
      <Details />
    </SheetRoute>
  );
}

function Details() {
  const close = useSheetClose();
  return (
    <Button
      label="Deposit details"
      variant="secondary"
      onPress={() => close(() => router.push(fundQrRoute("monad")))}
    />
  );
}
