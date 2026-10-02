import { StyleSheet, Text, View } from "react-native";
import { Info, Lock } from "~/components/kit/symbols";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { CardFace } from "~/features/card/CardFace";
import { useCardSummary } from "~/features/card/useCardSummary";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Card details (E5). The full number only ever shows inside the issuer's embed in a capture-protected view (passkey
 * first, auto-hide at 60 s); this build has no protected web view to host it, so the sheet says so instead of opening
 * the number anywhere else. What is known — the card and its last four — is shown; the lock names the blocker.
 */
export default function CardRevealSheet() {
  const { color } = useTheme();
  const card = useCardSummary().data?.cards.find((c) => c.state !== "CLOSED");
  return (
    <SheetRoute title="Card details">
      <View style={styles.card}>
        <CardFace last4={card?.last4 ?? undefined} />
      </View>
      <View style={styles.row}>
        <Lock size={SIZE.iconSm} color={color.text2} />
        <Text style={[TYPE.rowTitle, { color: color.text2 }]}>Number, expiry, CVV · Needs app update</Text>
      </View>
      <View style={styles.row}>
        <Info size={SIZE.iconSm} color={color.text3} />
        <Text style={[TYPE.rowDetail, styles.shrink, { color: color.text3 }]}>Shown only in a protected view</Text>
      </View>
    </SheetRoute>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: SPACE.xl },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  shrink: { flexShrink: 1 },
});
