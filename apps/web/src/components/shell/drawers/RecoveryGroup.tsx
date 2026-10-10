"use client";
/**
 * Recovery in Settings (F07, D-034, D-153; back on the web in R2.13 — the 8 Oct cleanup took the account page and the
 * phone's "Backup passkey" pointed at nothing): passkey sync first; a backup passkey (a second passkey's vault →
 * Senryo's encrypted `/v1/vault` copy plus the same vault downloaded as a recovery file); and the 24-word export behind
 * a step-up. The phrase lives in component state only, hides after a minute or when the tab is hidden, and is never
 * stored or logged.
 */
import { Download } from "lucide-react";
import { useState } from "react";
import { PhraseReveal } from "@/components/auth/phrase-reveal";
import { useStepUp } from "@/components/auth/step-up";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";

const RECOVERY_FILE = "senryo-recovery.json";
const JSON_INDENT = 2;

function download(json: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, JSON_INDENT)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = RECOVERY_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

/** Where the last backup landed: Senryo's encrypted copy and the file, or the file only (the api unreachable). */
type Backup = "none" | "saving" | "synced" | "file-only";

const BACKUP_NOTE: Record<Exclude<Backup, "none">, string> = {
  saving: "Saving an encrypted copy to Senryo…",
  synced: "Saved to Senryo (encrypted to the backup passkey) and downloaded as a file.",
  "file-only": "Senryo couldn't be reached — keep the downloaded file; it's the only copy of this backup.",
};

export function RecoveryGroup() {
  const account = useAccount();
  const stepUp = useStepUp();
  const [backup, setBackup] = useState<Backup>("none");
  const [phrase, setPhrase] = useState<string>();
  const client = account.client;
  const ready = client !== undefined && account.hint !== undefined;

  const addBackup = async () => {
    if (!client) return;
    const vault = await stepUp.confirm(
      {
        title: "Add a backup passkey",
        detail:
          "First confirm with your current passkey, then create a second one (another device or provider). It opens this same account on any device.",
        confirmLabel: "Start",
      },
      async () => (await import("@senryo/account")).addRecoveryPasskey(client, new Date()),
    );
    if (!vault) return;
    download(vault);
    setBackup("saving");
    try {
      const { saveVault } = await import("@/lib/account/remote");
      const label = `Backup passkey · ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
      await saveVault(client, vault, label, account.settings.faceId);
      setBackup("synced");
    } catch {
      setBackup("file-only");
    }
  };

  const reveal = async () => {
    if (!client) return;
    const words = await stepUp.confirm(
      {
        title: "Show your recovery phrase",
        detail: "24 words that control this account in any wallet. Anyone who sees them can take your funds.",
        confirmLabel: "Show with passkey",
      },
      async () => (await import("@senryo/account")).revealRecoveryPhrase(client),
    );
    if (words) setPhrase(words);
  };

  return (
    <div id="recovery" className="flex flex-col gap-3">
      <p className="text-meta text-text-2">
        Your passkey is your account. iCloud Keychain, Google Password Manager and 1Password sync it to your other
        devices — sign in there with "I have an account" and the same address appears.
      </p>
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-row">Backup passkey</p>
        <p className="text-meta text-text-2">
          For a provider that doesn't sync, or a move between Apple and Google: a second passkey. Senryo keeps an
          encrypted copy it can't open, and you get the same copy as a recovery file — both useless without that
          passkey.
        </p>
        <Button variant="secondary" disabled={!ready || backup === "saving"} onClick={() => void addBackup()}>
          {backup === "none" ? <PasskeyGlyph /> : <Download aria-hidden />}
          {backup === "none" ? "Add a backup passkey" : "Add another backup passkey"}
        </Button>
        {backup !== "none" ? (
          <p
            role="status"
            className={backup === "file-only" ? "text-caption text-destructive" : "text-meta text-text-2"}
          >
            {BACKUP_NOTE[backup]}
          </p>
        ) : null}
      </div>
      <details className="group">
        <summary className="cursor-pointer list-none font-semibold text-row text-text-2 hover:text-foreground">
          Export to another wallet
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {phrase ? (
            <PhraseReveal phrase={phrase} onHide={() => setPhrase(undefined)} />
          ) : (
            <>
              <p className="text-meta text-text-2">
                The 24 words behind your passkey import into any standard wallet (same address). Only for moving out —
                Senryo never needs them.
              </p>
              <Button variant="secondary" disabled={!ready} onClick={() => void reveal()}>
                Show recovery phrase
              </Button>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
