/**
 * Auth failure card (native): the shared copy table (`authFailureCopy`) — one honest title, the fix, the next action.
 * The most prominent action always agrees with the warning (review R04):
 * - a failed *create* that may have left a passkey behind → **"I already have an account"** is primary (signing in can
 *   never make a second account); creating again is only reachable from a sign-in that finds no passkey;
 * - a failure repetition can't repair (`prf-unavailable`, `not-supported`) → the web app is primary, no retry;
 * - `bad-configuration` (association files) → the web app first, retry kept as the secondary;
 * - anything else → "Try again".
 * `onBack` always returns to where the user was. No promise is made about passkeys syncing between devices.
 */
import { type AuthFailure, authFailureCopy, mayHaveLeftPasskey } from "@senryo/account";
import { WEB_ORIGIN } from "@senryo/config";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { AuthCard } from "./AuthCard";

export type FailedFlow = "create" | "sign-in" | "unlock" | "recover";

export function AuthFailureCard({
  kind,
  flow,
  onRetry,
  onSignIn,
  onCreate,
  onBack,
}: {
  kind: AuthFailure;
  flow: FailedFlow;
  onRetry: () => void;
  onSignIn?: () => void;
  onCreate?: () => void;
  onBack?: () => void;
}) {
  const { color } = useTheme();
  const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
  const orphanRisk = flow === "create" && mayHaveLeftPasskey(kind) && onSignIn !== undefined;
  const webOnly = kind === "prf-unavailable" || kind === "not-supported";
  const webFirst = webOnly || kind === "bad-configuration";
  const openWeb = () => void Linking.openURL(WEB_ORIGIN);
  return (
    <AuthCard glyph="warning" tone="down" title={copy.title} body={copy.body}>
      {orphanRisk ? (
        <View style={[styles.note, { borderColor: color.hairline, backgroundColor: color.muted }]}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            Your passkey may already be saved on this device. Sign in with it first, so you don’t end up with two
            accounts. If no passkey is found, you can create the account again from there.
          </Text>
        </View>
      ) : null}
      {webFirst ? (
        <View style={[styles.note, { borderColor: color.hairline, backgroundColor: color.muted }]}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {webOnly
              ? "Trying again here won’t change this. The web app at senryo.xyz uses the same account."
              : "This is a setup problem on our side, not something you did. The web app at senryo.xyz uses the same account meanwhile."}
          </Text>
        </View>
      ) : null}
      {orphanRisk ? (
        <Button label="I already have an account" onPress={onSignIn} />
      ) : webFirst ? (
        <Button label="Open senryo.xyz" onPress={openWeb} />
      ) : (
        <Button label="Try again" onPress={onRetry} />
      )}
      {kind === "no-credentials" && onCreate ? (
        <Button label="Create account" variant="outline" onPress={onCreate} />
      ) : null}
      {webFirst && !webOnly ? <Button label="Try again" variant="outline" onPress={onRetry} /> : null}
      {onBack ? <Button label="Back" variant="ghost" onPress={onBack} /> : null}
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  note: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md },
});
