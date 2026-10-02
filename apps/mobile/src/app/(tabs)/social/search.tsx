import { useLocalSearchParams } from "expo-router";
import { SearchScreen } from "~/features/search/SearchScreen";

/** `/social/search[?kind=traders]` — the same Search as Markets (F31, F1), kept on the Social stack. */
export default function SocialSearch() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <SearchScreen initialKind={kind === "traders" ? "traders" : "all"} />;
}
