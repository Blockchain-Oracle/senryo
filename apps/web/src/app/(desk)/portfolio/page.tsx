import { Redirect } from "@/components/shell/redirect";
import { ROUTES } from "@/lib/constants/routes";

/** Legacy desk path → Home (as the phone remaps `/portfolio`). */
export default function PortfolioPage() {
  return <Redirect to={ROUTES.home} />;
}
