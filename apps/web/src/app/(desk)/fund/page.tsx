import { Redirect } from "@/components/shell/redirect";
import { ROUTES } from "@/lib/constants/routes";

/** Legacy desk path → Add money (as the phone remaps `/fund`). */
export default function FundPage() {
  return <Redirect to={ROUTES.addMoney} />;
}
