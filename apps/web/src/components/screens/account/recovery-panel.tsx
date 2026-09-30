"use client";

/**
 * Recovery (F07, D-034): passkey sync first; a backup passkey (second-passkey vault → Senryo's `/v1/vault` copy + the
 * same vault as a recovery file, D-153); and, under
 * Advanced only, the 24-word export behind a step-up. The phrase lives in component state only, is hidden again after
 * a minute or the moment the tab is hidden, and is never stored or logged.
 */
import { Cloud, Download, KeyRound } from "lucide-react";
import { useState } from "react";
import { useStepUp } from "@/components/auth/step-up";
import { Panel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";
import { PhraseReveal } from "./phrase-reveal";

const RECOVERY_FILE = "senryo-recovery.json";

function download(json: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = RECOVERY_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

/** Where the last backup landed: Senryo's encrypted copy + the file, or the file only (API unreachable). */
type Backup = "none" | "saving" | "synced" | "file-only";

const BACKUP_NOTE: Record<Exclude<Backup, "none">, string> = {
  saving: "Saving an encrypted copy to Senryo…",
  synced: "Saved to Senryo (encrypted to the backup passkey) and downloaded as a file.",
  "file-only": "Senryo couldn't be reached — keep the downloaded file; it's the only copy of this backup.",
};

export function RecoveryPanel() {
  const account = useAccount();
  const stepUp = useStepUp();
  const [backup, setBackup] = useState<Backup>("none");
  const [phrase, setPhrase] = useState<string>();
  const ready = account.status === "ready" && account.client !== undefined && account.hint !== undefined;

  const addBackup = async () => {
    const client = account.client;
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
    const client = account.client;
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
    <Panel className="mx-4">
      <div className="grid gap-1 border-border border-b px-3 py-3">
        <p className="flex items-center gap-1.5 font-mono text-caption">
          <Cloud className="size-3.5 text-primary" aria-hidden />
          PASSKEY SYNC
        </p>
        <p className="text-caption text-muted-foreground">
          Your passkey is your account. iCloud Keychain, Google Password Manager and 1Password sync it to your other
          devices — sign in there with "I already have an account" and the same address appears.
        </p>
      </div>
      <div className="grid gap-2 border-border border-b px-3 py-3">
        <p className="font-mono text-caption">BACKUP PASSKEY</p>
        <p className="text-caption text-muted-foreground">
          For a provider that doesn't sync, or a move between Apple and Google: a second passkey. Senryo keeps an
          encrypted copy it can't open, and you get the same copy as a recovery file — both useless without that
          passkey.
        </p>
        <Button variant="outline" disabled={!ready || backup === "saving"} onClick={() => void addBackup()}>
          {backup === "none" ? <KeyRound /> : <Download />}
          {backup === "none" ? "Add a backup passkey" : "Add another backup passkey"}
        </Button>
        {backup !== "none" ? (
          <p
            role="status"
            className={backup === "file-only" ? "text-caption text-down" : "text-caption text-muted-foreground"}
          >
            {BACKUP_NOTE[backup]}
          </p>
        ) : null}
      </div>
      <details className="group px-3 py-3">
        <summary className="cursor-pointer list-none font-mono text-caption text-muted-foreground hover:text-foreground">
          ADVANCED · EXPORT TO ANOTHER WALLET
        </summary>
        <div className="mt-2 grid gap-2">
          {phrase ? (
            <PhraseReveal phrase={phrase} onHide={() => setPhrase(undefined)} />
          ) : (
            <>
              <p className="text-caption text-muted-foreground">
                The 24 words behind your passkey import into any standard wallet (same address). Only for moving out —
                Senryo never needs them.
              </p>
              <Button variant="outline" disabled={!ready} onClick={() => void reveal()}>
                Show recovery phrase
              </Button>
            </>
          )}
        </div>
      </details>
    </Panel>
  );
}
