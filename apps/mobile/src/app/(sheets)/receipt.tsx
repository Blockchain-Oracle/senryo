import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function ReceiptSheet() {
  return (
    <SheetRoute
      title="Receipt"
      body="After a fill you'll see price, size, fee and the transaction, with a share card."
    />
  );
}
