/**
 * The in-flight ceremony (RN port of 21st verify-identity-3 #19036 + Task Steps #23569): what the OS sheet is doing,
 * and the D-029 interstitial when a provider asks twice on first setup. Honest while Face ID is up.
 */
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AuthCard } from "./AuthCard";

export type CeremonyKind = "create" | "sign-in" | "unlock" | "recover";

const TITLE: Record<CeremonyKind, string> = {
  create: "Creating your account",
  "sign-in": "Opening your account",
  unlock: "Unlocking trading",
  recover: "Opening with your backup passkey",
};

const STEPS: Record<CeremonyKind, readonly string[]> = {
  create: ["Passkey saved to your provider", "Account derived on this phone", "Trading session unlocked"],
  "sign-in": ["Passkey confirmed", "Same account rebuilt here", "Trading session unlocked"],
  unlock: ["Face ID confirmed", "Trading session unlocked"],
  recover: ["Backup passkey confirmed", "Recovery file decrypted", "Trading session unlocked"],
};

const SHEET_WORD = Platform.OS === "ios" ? "Face ID" : "your fingerprint or screen lock";

export function CeremonyCard({ kind, extraPrompt }: { kind: CeremonyKind; extraPrompt: boolean }) {
  const { color } = useTheme();
  return (
    <AuthCard
      glyph={kind === "unlock" ? "faceId" : "passkey"}
      busy
      title={TITLE[kind]}
      body={
        extraPrompt
          ? "One more confirmation — some passkey providers ask twice the first time. Same passkey, same account."
          : `Confirm with ${SHEET_WORD} on the system sheet.`
      }
      footer="KEYS STAY ON THIS PHONE · NO SEED PHRASE"
    >
      <View
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={[styles.wait, { borderColor: color.hairline, backgroundColor: color.muted }]}
      >
        <View style={[styles.dot, { backgroundColor: color.primary }]} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {extraPrompt ? "Waiting for the second confirmation…" : "Waiting for your passkey…"}
        </Text>
      </View>
      <View accessibilityRole="list" style={styles.steps}>
        {STEPS[kind].map((label, i) => (
          <View key={label} style={styles.step}>
            {i === 0 ? (
              <ActivityIndicator size="small" color={color.primary} style={styles.mark} />
            ) : (
              <View style={[styles.pending, { backgroundColor: color.inkMuted }]} />
            )}
            <Text style={[TYPE.caption, { color: i === 0 ? color.ink : color.inkMuted }]}>{label}</Text>
          </View>
        ))}
      </View>
    </AuthCard>
  );
}

const PENDING_DOT = SPACE.xs + SPACE.xxs;

const styles = StyleSheet.create({
  wait: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
    padding: SPACE.md,
  },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
  steps: { gap: SPACE.sm },
  step: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.icon + SPACE.sm },
  mark: { width: SIZE.icon, height: SIZE.icon },
  pending: { width: PENDING_DOT, height: PENDING_DOT, borderRadius: RADIUS.sm, marginHorizontal: SPACE.xs + SPACE.xxs },
});
