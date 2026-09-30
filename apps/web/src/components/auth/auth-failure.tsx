"use client";

/**
 * Auth failure card: one honest title + the fix, from the shared copy table (`authFailureCopy`), and the next action.
 * F65: a desktop whose passkey provider has no PRF gets "Use your phone" — a QR to the same page, because the
 * account is the passkey and phones carry PRF (iCloud Keychain, Google Password Manager).
 */
import { type AuthFailure, authFailureCopy, mayHaveLeftPasskey } from "@senryo/account";
import { WEB_ORIGIN } from "@senryo/config";
import { KeyRound, RotateCcw, Smartphone, TriangleAlert } from "lucide-react";
import { AuthCard, AuthCardBody, AuthCardHeader } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { QRCodeDisplay } from "@/components/ui/qr-code-generator";
import { useQr } from "@/hooks/use-qr";
import { PHONE_HANDOFF_PATH } from "@/lib/constants/auth";

const PHONE_QR_PX = 220;
const PHONE_URL = `${WEB_ORIGIN}${PHONE_HANDOFF_PATH}`;

function PhoneHandoff() {
  const qr = useQr(PHONE_URL, PHONE_QR_PX);
  return (
    <QRCodeDisplay
      data={qr}
      isLoading={qr === null}
      title="Use your phone"
      description="Scan to open Senryo on your phone. Its passkey (iCloud Keychain or Google Password Manager) opens the same account here later."
      fileName="senryo-open-on-phone.png"
    />
  );
}

export interface AuthFailureProps {
  kind: AuthFailure;
  /** The flow that failed — a failed *create* may have left a passkey behind (never create twice). */
  flow: "create" | "sign-in" | "unlock" | "recover" | "gate";
  onRetry: () => void;
  onSignIn?: () => void;
  onCreate?: () => void;
}

export function AuthFailureCard({ kind, flow, onRetry, onSignIn, onCreate }: AuthFailureProps) {
  const copy = authFailureCopy(kind, "web");
  const orphanRisk = flow === "create" && mayHaveLeftPasskey(kind);
  return (
    <div className="grid gap-3">
      <AuthCard role="alert">
        <AuthCardHeader glyph={<TriangleAlert />} tone="down" title={copy.title}>
          {copy.body}
        </AuthCardHeader>
        <AuthCardBody>
          {orphanRisk ? (
            <p className="rounded-sm border border-border bg-muted/40 p-3 text-caption text-muted-foreground">
              If your passkey sheet finished, the passkey is already saved — tap{" "}
              <span className="text-foreground">I already have an account</span> instead of creating another one.
            </p>
          ) : null}
          <Button onClick={onRetry} className="w-full">
            <RotateCcw />
            Try again
          </Button>
          {kind === "no-credentials" && onCreate ? (
            <Button variant="outline" onClick={onCreate} className="w-full">
              Create account
            </Button>
          ) : null}
          {orphanRisk && onSignIn ? (
            <Button variant="outline" onClick={onSignIn} className="w-full">
              <KeyRound />I already have an account
            </Button>
          ) : null}
        </AuthCardBody>
      </AuthCard>
      {kind === "prf-unavailable" ? <PhoneHandoff /> : null}
      {kind === "prf-unavailable" ? (
        <p className="flex items-center justify-center gap-1.5 font-mono text-micro text-muted-foreground uppercase tracking-[0.12em]">
          <Smartphone className="size-3.5" aria-hidden />
          Or save passkeys to Google Password Manager in Chrome settings
        </p>
      ) : null}
    </div>
  );
}
