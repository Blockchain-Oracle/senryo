import { useLocalSearchParams } from "expo-router";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { PaymentDetail } from "~/features/card/PaymentDetail";
import { QuietLine } from "~/features/markets/QuietLine";

export default function CardPaymentSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <SheetRoute title="Card payment">
      {id ? <PaymentDetail id={id} sheet /> : <QuietLine>Payment not found</QuietLine>}
    </SheetRoute>
  );
}
