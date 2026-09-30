/**
 * Above the portfolio: the practice starter claim for a signed-in account that hasn't claimed (F05, the TTFT moment),
 * or the way in for a guest (F03). Hidden once claimed — the balance itself is the proof.
 */
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { StarterCard } from "./StarterCard";

export function AccountStrip() {
  const { color } = useTheme();
  const account = useAccount();
  if (!account.ready) return null;
  if (account.hint) return <StarterCard hideWhenClaimed />;
  return (
    <View style={[styles.guest, { borderColor: color.hairline }]}>
      <Text style={[TYPE.caption, styles.text, { color: color.inkMuted }]}>
        Browsing without an account · prices are live.
      </Text>
      <Button label="Create" size="sm" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
    </View>
  );
}

const styles = StyleSheet.create({
  guest: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
    padding: SPACE.md,
  },
  text: { flex: 1 },
});
