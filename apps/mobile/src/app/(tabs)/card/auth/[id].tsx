import { useLocalSearchParams } from "expo-router";
import { PaymentDetail } from "~/features/card/PaymentDetail";

/** `/card/auth/:id` — one card payment (E6); push taps and links resolve any id. */
export default function AuthorizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentDetail id={id} />;
}
