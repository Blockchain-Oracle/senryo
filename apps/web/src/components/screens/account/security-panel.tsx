"use client";

/**
 * Security (F60 / F04, D-037): session length, idle lock, passkey per trade, lock now. Tightening applies at once;
 * loosening (longer, or a weaker per-trade mode) asks for a fresh passkey first (spec session-policy §2).
 */
import {
  defaultFaceIdMode,
  FACE_ID_TRADE_THRESHOLD_USD6,
  type FaceIdMode,
  isLoosening,
  SESSION_IDLE_CHOICES_MS,
  SESSION_TTL_CHOICES_MS,
  type SessionSettings,
} from "@senryo/account";
import { formatUnits } from "@senryo/core";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useStepUp } from "@/components/auth/step-up";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { Panel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";

const MS_PER_MINUTE = 60_000;
const USD_DECIMALS = 6;
const minutes = (ms: number) => `${ms / MS_PER_MINUTE} min`;
const threshold = `$${formatUnits(FACE_ID_TRADE_THRESHOLD_USD6, USD_DECIMALS, 0)}`;
const FACE_ID_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "above-threshold", label: `≥ ${threshold}` },
  { value: "every-trade", label: "Every" },
] as const;

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3">
      <div>
        <p className="text-row">{title}</p>
        <p className="text-meta text-text-2">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function SecurityPanel() {
  const account = useAccount();
  const stepUp = useStepUp();
  const [note, setNote] = useState<string>();
  const s = account.settings;
  const faceId: FaceIdMode = s.faceId ?? defaultFaceIdMode(ACTIVE_NETWORK.key);
  const disabled = account.status !== "ready" || !account.hint;

  const apply = async (next: SessionSettings) => {
    setNote(undefined);
    if (!isLoosening(s, next, defaultFaceIdMode(ACTIVE_NETWORK.key))) {
      await account.applySettings(next);
      setNote("Saved.");
      return;
    }
    // Loosening: explain first; `applySettings` then runs the one passkey ceremony itself.
    const done = await stepUp.confirm(
      {
        title: "Loosen session security",
        detail: "Longer sessions or fewer passkey checks need a fresh confirmation.",
      },
      async () => {
        await account.applySettings(next);
        return true;
      },
    );
    setNote(done ? "Saved." : "Unchanged.");
  };

  return (
    <Panel>
      <Row title="Session length" hint="Trading locks after this long, however active you are.">
        <SegmentedControl
          label="Session length"
          fill
          value={String(s.ttlMs)}
          options={SESSION_TTL_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms), disabled }))}
          onValueChange={(v) => void apply({ ...s, ttlMs: Number(v) })}
        />
      </Row>
      <Row title="Idle lock" hint="…or after this long without a signature.">
        <SegmentedControl
          label="Idle lock"
          fill
          value={String(s.idleMs)}
          options={SESSION_IDLE_CHOICES_MS.map((ms) => ({ value: String(ms), label: minutes(ms), disabled }))}
          onValueChange={(v) => void apply({ ...s, idleMs: Number(v) })}
        />
      </Row>
      <Row
        title="Passkey per trade"
        hint={`Practice default: off (the prompt-free session). Mainnet default: trades of ${threshold} or more.`}
      >
        <SegmentedControl
          label="Passkey per trade"
          fill
          value={faceId}
          options={FACE_ID_OPTIONS.map((o) => ({ ...o, disabled }))}
          onValueChange={(v) => void apply({ ...s, faceId: v as FaceIdMode })}
        />
      </Row>
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <p className="flex items-center gap-2 text-meta text-text-2" aria-live="polite">
          <PasskeyGlyph />
          {note ?? "Withdrawals, sends, card limits and your recovery phrase always ask for a fresh passkey."}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={account.snapshot.status !== "unlocked"}
          onClick={() => account.lock()}
        >
          <Lock />
          Lock now
        </Button>
      </div>
    </Panel>
  );
}
