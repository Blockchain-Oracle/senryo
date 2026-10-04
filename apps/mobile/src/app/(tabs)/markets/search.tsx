import { useLocalSearchParams } from "expo-router";
import { SearchScreen } from "~/features/search/SearchScreen";

/** `/markets/search` — search markets and traders, pushed on the Markets stack (J3, F31). */
export default function Search() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <SearchScreen initialKind={kind === "predict" ? "predict" : "all"} />;
}
