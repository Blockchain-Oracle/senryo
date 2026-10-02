/**
 * Add to Wallet (E5): shown, locked, with its named dependency — never a fake button. iOS needs Apple's Apple Pay
 * In-App Provisioning entitlement (granted to the card issuer's app, normally after an issuer partnership); Android push
 * provisioning is issuer-dependent. The row opens a small sheet that says so. The Wallet mark is the identity registry's
 * `provider:apple-wallet` / `provider:google-wallet` when its first-party art is recorded; until then a card glyph disc
 * stands in (never a drawn imitation of Apple's or Google's artwork).
 */
import { hasArt, ids } from "@senryo/identity";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { CreditCard, Info, Lock } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const IOS = Platform.OS === "ios";
const WALLET_ID = ids.provider(IOS ? "apple-wallet" : "google-wallet");
export const WALLET_TITLE = IOS ? "Add to Apple Wallet" : "Add to Google Wallet";
const LOCK_REASON = IOS ? "Needs Apple approval" : "Needs issuer support";
const WHY = IOS
  ? "Apple grants in-app provisioning to the card issuer’s app."
  : "Google Wallet provisioning comes from the card issuer.";
const GLYPH = 20;

export function WalletMark({ size = SIZE.markRow }: { size?: number }) {
  const { color } = useTheme();
  if (hasArt(WALLET_ID)) return <EntityMark id={WALLET_ID} size={size} decorative />;
  return (
    <View style={[styles.disc, { width: size, height: size, backgroundColor: color.raised2 }]}>
      <CreditCard size={GLYPH} color={color.ink} />
    </View>
  );
}

export function WalletRow({ onPress }: { onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${WALLET_TITLE}, locked, ${LOCK_REASON}`}
      style={({ pressed }) => [styles.row, pressed ? { opacity: PRESSED } : null]}
    >
      <WalletMark />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{WALLET_TITLE}</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{LOCK_REASON}</Text>
      </View>
      <Lock size={SIZE.iconSm} color={color.text3} />
    </Pressable>
  );
}

/** The sheet the row opens: the mark, the lock and its reason, the one-line why. */
export function WalletSheetBody() {
  const { color } = useTheme();
  return (
    <View style={styles.sheet}>
      <WalletMark size={SIZE.markDetail} />
      <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
        {WALLET_TITLE}
      </Text>
      <View style={styles.lock}>
        <Lock size={SIZE.iconSm} color={color.text2} />
        <Text style={[TYPE.rowTitle, { color: color.text2 }]}>{LOCK_REASON}</Text>
      </View>
      <View style={styles.why}>
        <Info size={SIZE.iconSm} color={color.text3} />
        <Text style={[TYPE.rowDetail, styles.whyText, { color: color.text3 }]}>{WHY}</Text>
      </View>
    </View>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  disc: { borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  text: { flex: 1, gap: SPACE.xxs },
  sheet: { alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.sm },
  center: { textAlign: "center" },
  lock: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  why: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xs, paddingHorizontal: SPACE.md },
  whyText: { flexShrink: 1, textAlign: "center" },
});
