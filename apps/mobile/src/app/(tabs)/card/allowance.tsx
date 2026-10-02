import { useLocalSearchParams } from "expo-router";
import { CardLimit } from "~/features/card/CardLimit";

/** `/card/allowance` — the daily limit (E3); `?unfreeze=1` signs a new limit and opens the frozen card. */
export default function AllowanceScreen() {
  const { unfreeze } = useLocalSearchParams<{ unfreeze?: string }>();
  return <CardLimit unfreeze={unfreeze === "1"} />;
}
