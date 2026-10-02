import type { Address } from "@senryo/core";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { ActivityRow } from "~/features/portfolio/ActivityRow";
import { useActivity } from "~/features/portfolio/useActivity";
import { ROUTES } from "~/lib/constants/routes";
import { SPACE, TYPE, useTheme } from "~/theme";

const PREVIEW_ROWS = 4;
/** The owner's indexed history includes private events; public profiles use the actor-filtered public feed. */
export function RecentActivity({ address }: { address: Address }) {
  const { color } = useTheme();
  const { reading } = useActivity(address);
  const rows =
    reading.status === "fresh" || reading.status === "stale" ? reading.value.slice(0, PREVIEW_ROWS) : undefined;
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        Recent activity
      </Text>
      {rows?.map((row) => (
        <ActivityRow key={row.id} row={row} />
      ))}
      {!rows?.length ? (
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {rows ? "No activity yet" : reading.status === "failed" ? "Activity unavailable" : "Reading activity…"}
        </Text>
      ) : null}
      <Button variant="ghost" label="View history" onPress={() => router.push(ROUTES.activity)} />
    </View>
  );
}
