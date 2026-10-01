import { useLocalSearchParams } from "expo-router";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { LeaderboardInfo } from "~/features/social/LeaderboardInfo";
import { DEFAULT_PERIOD, isPeriod } from "~/features/social/leaderboard-copy";

/**
 * The leaderboard's info sheet (J8, S1b.14; direction §9): the published definition of the ranking for the period the
 * board is showing. Opened from the one-line definition under the period chips; dismissing restores the board.
 */
export default function LeaderboardInfoSheet() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  return (
    <SheetRoute title="How ranking works">
      <LeaderboardInfo period={isPeriod(period) ? period : DEFAULT_PERIOD} />
    </SheetRoute>
  );
}
