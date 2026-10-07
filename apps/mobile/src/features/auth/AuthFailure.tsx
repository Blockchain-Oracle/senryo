/** Native auth failures stay in the app. Passkeys and signing are never replaced by a web handoff. */
import { type AuthFailure, authFailureCopy, mayHaveLeftPasskey } from "@senryo/account";
import { Platform } from "react-native";
import { Button } from "~/components/kit/Button";
import { AuthCard } from "./AuthCard";

export type FailedFlow = "create" | "sign-in" | "unlock" | "recover";

const ORPHAN_NOTE =
  "Your passkey may already be saved on this phone. Sign in with it first, so you don’t end up with two accounts.";
const UPDATE_REQUIRED: readonly AuthFailure[] = [
  "prf-unavailable",
  "not-supported",
  "host-not-allowed",
  "insecure-context",
];

export function AuthFailureCard({
  kind,
  flow,
  onRetry,
  onSignIn,
  onCreate,
  onClose,
}: {
  kind: AuthFailure;
  flow: FailedFlow;
  onRetry: () => void;
  onSignIn?: () => void;
  onCreate?: () => void;
  onClose: () => void;
}) {
  const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
  const orphanRisk = flow === "create" && mayHaveLeftPasskey(kind) && onSignIn !== undefined;
  const updateRequired = UPDATE_REQUIRED.includes(kind);
  const nativeCopy =
    kind === "bad-configuration"
      ? {
          title: copy.title,
          body: "Senryo couldn’t open your account. Try again, or keep browsing and return after updating the app. Your account hasn’t changed.",
        }
      : kind === "host-not-allowed" || kind === "insecure-context"
        ? {
            title: "Account setup unavailable",
            body: "This build can’t open your Senryo account. Update the app before trying again. Your account hasn’t changed.",
          }
        : copy;
  return (
    <AuthCard
      tone="down"
      title={nativeCopy.title}
      body={orphanRisk ? `${nativeCopy.body} ${ORPHAN_NOTE}` : nativeCopy.body}
    >
      {orphanRisk ? (
        <Button label="I already have an account" onPress={onSignIn} />
      ) : updateRequired ? (
        <Button label="Keep browsing" onPress={onClose} />
      ) : (
        <Button label="Try again" onPress={onRetry} />
      )}
      {kind === "no-credentials" && onCreate ? (
        <Button label="Create account" variant="ghost" size="sm" onPress={onCreate} />
      ) : null}
      {!updateRequired ? <Button label="Keep browsing" variant="ghost" size="sm" onPress={onClose} /> : null}
    </AuthCard>
  );
}
