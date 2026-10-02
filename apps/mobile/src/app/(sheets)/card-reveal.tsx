import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function CardRevealSheet() {
  return (
    <SheetRoute
      title="Reveal card details"
      body="Secure mobile card reveal is unavailable until the issuer connection and protected-view acceptance are complete."
    />
  );
}
