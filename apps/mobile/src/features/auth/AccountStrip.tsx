/**
 * At the top of Home: the practice starter claim for a signed-in account that hasn't claimed (F05, the TTFT moment),
 * or the way in for a guest (F03) as one borderless filled row with its one action. Hidden once claimed — the balance
 * itself is the proof — so a funded Home opens straight on the balance's curve.
 */
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { useGroupFill } from "~/components/kit/Surface";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { SHEET_SHAPE, SPACE, TYPE, useTheme } from "~/theme";
import { StarterCard } from "./StarterCard";

export function AccountStrip() {
  const { color } = useTheme();
  const account = useAccount();
  const fill = useGroupFill();
  if (!account.ready) return null;
  if (account.hint) return <StarterCard hideWhenClaimed />;
  return (
    <View style={[styles.guest, { backgroundColor: fill }]}>
      <Text style={[TYPE.rowDetail, styles.text, { color: color.text2 }]}>
        Browsing without an account · prices are live.
      </Text>
      <Button
        label="Create"
        size="sm"
        block={false}
        style={styles.action}
        onPress={() => router.push(ROUTES.accountRequired)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  guest: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    borderRadius: SHEET_SHAPE.rowRadius,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  text: { flex: 1 },
  // The kit's inline button pins to the top of a row; here it sits on the text's centre line.
  action: { alignSelf: "center" },
});
