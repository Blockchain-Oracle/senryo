/**
 * Auth failure card (native): the shared copy table (`authFailureCopy`) — one honest title, the fix, the next action.
 * A failed *create* may have left a passkey behind: never create twice, offer "I already have an account" instead.
 * `bad-configuration` (association files) and `prf-unavailable` point to the web app, same account there.
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
}: {
  kind: AuthFailure;
  flow: FailedFlow;
  onRetry: () => void;
  onSignIn?: () => void;
  onCreate?: () => void;
}) {
  const { color } = useTheme();
  const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
  const orphanRisk = flow === "create" && mayHaveLeftPasskey(kind);
  const webFallback = kind === "bad-configuration" || kind === "prf-unavailable" || kind === "not-supported";
  return (
    <AuthCard glyph="warning" tone="down" title={copy.title} body={copy.body}>
      {orphanRisk ? (
        <View style={[styles.note, { borderColor: color.hairline, backgroundColor: color.muted }]}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            If the system sheet finished, your passkey is already saved — tap "I already have an account" instead of
            creating another one.
          </Text>
        </View>
      ) : null}
      <Button label="Try again" onPress={onRetry} />
      {kind === "no-credentials" && onCreate ? (
        <Button label="Create account" variant="outline" onPress={onCreate} />
      ) : null}
      {orphanRisk && onSignIn ? (
        <Button label="I already have an account" variant="outline" onPress={onSignIn} />
      ) : null}
      {webFallback ? (
        <Button label="Open senryo.xyz" variant="ghost" onPress={() => void Linking.openURL(WEB_ORIGIN)} />
      ) : null}
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  note: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md },
});
