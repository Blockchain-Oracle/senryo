import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function CardRevealSheet() {
  return (
    <SheetRoute
      title="Reveal card details"
      body="The full card number shows only after Face ID, hides itself after 30 seconds and is blocked from screenshots. Arrives with the card service."
    />
  );
}
