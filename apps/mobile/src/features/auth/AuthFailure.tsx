/**
 * An auth failure inside its sheet (Codex consult 1 Oct): the shared copy table (`authFailureCopy`) as one title and
 * one explanation, one primary action, at most one quiet action under it. No warning tile, no boxed note, no Back
 * button — the handle and the scrim return to where the user was.
 * The primary action always agrees with the explanation (review R04):
 * - a failed *create* that may have left a passkey behind → **"I already have an account"** (signing in can never
 *   make a second account); the explanation says why; creating again is only reachable from a sign-in that finds no
 *   passkey;
 * - a failure repetition can't repair (`prf-unavailable`, `not-supported`, a wrong host) → the web app, no retry;
 * - `bad-configuration` (association files) → the web app first, "Try again" as the quiet action;
 * - anything else → "Try again".
 * No promise is made about passkeys syncing between devices.
 */
import { type AuthFailure, authFailureCopy, mayHaveLeftPasskey } from "@senryo/account";
import { WEB_ORIGIN } from "@senryo/config";
import { Linking, Platform } from "react-native";
import { Button } from "~/components/kit/Button";
import { AuthCard } from "./AuthCard";

export type FailedFlow = "create" | "sign-in" | "unlock" | "recover";

const ORPHAN_NOTE =
  "Your passkey may already be saved on this phone. Sign in with it first, so you don’t end up with two accounts.";
const WEB_ONLY: readonly AuthFailure[] = ["prf-unavailable", "not-supported", "host-not-allowed", "insecure-context"];

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
  const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
  const orphanRisk = flow === "create" && mayHaveLeftPasskey(kind) && onSignIn !== undefined;
  const webOnly = WEB_ONLY.includes(kind);
  const webFirst = webOnly || kind === "bad-configuration";
  const openWeb = () => void Linking.openURL(WEB_ORIGIN);
  return (
    <AuthCard tone="down" title={copy.title} body={orphanRisk ? `${copy.body} ${ORPHAN_NOTE}` : copy.body}>
      {orphanRisk ? (
        <Button label="I already have an account" onPress={onSignIn} />
      ) : webFirst ? (
        <Button label="Open senryo.xyz" onPress={openWeb} />
      ) : (
        <Button label="Try again" onPress={onRetry} />
      )}
      {kind === "no-credentials" && onCreate ? (
        <Button label="Create account" variant="ghost" size="sm" onPress={onCreate} />
      ) : null}
      {webFirst && !webOnly ? <Button label="Try again" variant="ghost" size="sm" onPress={onRetry} /> : null}
    </AuthCard>
  );
}
