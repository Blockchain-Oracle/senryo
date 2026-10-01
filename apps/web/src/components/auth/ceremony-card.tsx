"use client";

/**
 * The in-flight ceremony state (21st verify-identity-3 structure: glyph with a spinner badge, "waiting" row) plus the
 * D2 execution trace (21st Task Steps) — honest about what is happening while the browser's passkey sheet is up.
 * The D-029 interstitial: when a provider asks twice on first setup, the copy says so before the second prompt.
 */
import { Loader2, ShieldCheck } from "lucide-react";
import { PASSKEY_TILE_EDGE, PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { AuthCard, AuthCardBody, AuthCardFooter, AuthCardHeader } from "@/components/ui/auth-card";
import { TaskSteps } from "@/components/ui/task-steps";
import { TextShimmer } from "@/components/ui/text-shimmer";

export type CeremonyKind = "create" | "sign-in" | "unlock" | "recover";

const TITLE: Record<CeremonyKind, string> = {
  create: "Creating your account",
  "sign-in": "Opening your account",
  unlock: "Unlocking trading",
  recover: "Opening with your backup passkey",
};

const STEPS: Record<CeremonyKind, { id: string; label: string }[]> = {
  create: [
    { id: "passkey", label: "Passkey saved to your provider" },
    { id: "derive", label: "Account derived on this device" },
    { id: "session", label: "Trading session unlocked" },
  ],
  "sign-in": [
    { id: "passkey", label: "Passkey confirmed" },
    { id: "derive", label: "Same account rebuilt here" },
    { id: "session", label: "Trading session unlocked" },
  ],
  unlock: [
    { id: "passkey", label: "Passkey confirmed" },
    { id: "session", label: "Trading session unlocked" },
  ],
  recover: [
    { id: "passkey", label: "Backup passkey confirmed" },
    { id: "derive", label: "Recovery file decrypted" },
    { id: "session", label: "Trading session unlocked" },
  ],
};

export function CeremonyCard({ kind, extraPrompt }: { kind: CeremonyKind; extraPrompt: boolean }) {
  return (
    <AuthCard aria-busy>
      <AuthCardHeader
        glyph={<PasskeyGlyph size={PASSKEY_TILE_EDGE} />}
        badge={<Loader2 className="animate-spin" />}
        title={TITLE[kind]}
      >
        {extraPrompt
          ? "One more confirmation — some passkey providers ask twice the first time. Same passkey, same account."
          : "Your browser shows its passkey sheet: confirm with Face ID, Touch ID or your device PIN."}
      </AuthCardHeader>
      <AuthCardBody>
        <div className="flex items-center justify-center gap-2 rounded-sm border border-border bg-muted/40 p-3">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
          <TextShimmer className="font-mono text-caption">
            {extraPrompt ? "Waiting for the second confirmation…" : "Waiting for your passkey…"}
          </TextShimmer>
        </div>
        <TaskSteps steps={STEPS[kind]} current={0} label={TITLE[kind]} className="border-border border-t pt-2" />
      </AuthCardBody>
      <AuthCardFooter>
        <ShieldCheck aria-hidden />
        Keys stay on this device · no seed phrase
      </AuthCardFooter>
    </AuthCard>
  );
}
