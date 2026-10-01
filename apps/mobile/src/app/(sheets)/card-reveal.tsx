import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function CardRevealSheet() {
  return (
    <SheetRoute
      title="Reveal card details"
      body="No card has been issued yet — the card shown is a sample, so there is no number to reveal. Once yours is issued, its full number shows only after Face ID, hides itself after 30 seconds and is blocked from screenshots."
    />
  );
}
