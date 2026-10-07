import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/constants/routes";

/** Compatibility route: the persisted step now opens its primer over the real Home. */
export default function FaceIdStep() {
  return <Redirect href={ROUTES.home} />;
}
