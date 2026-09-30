"use client";

/**
 * Recovery (F07, D-034): passkey sync first; a backup passkey (second-passkey vault → recovery file); and, under
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

export function RecoveryPanel() {
  const account = useAccount();
  const stepUp = useStepUp();
  const [saved, setSaved] = useState(false);
  const [phrase, setPhrase] = useState<string>();
  const ready = account.status === "ready" && account.client !== undefined && account.hint !== undefined;

  const addBackup = async () => {
    const client = account.client;
    if (!client) return;
    const vault = await stepUp.confirm(
      {
        title: "Add a backup passkey",
        detail:
          "First confirm with your current passkey, then create a second one (another device or provider). Together with the recovery file it opens this same account.",
        confirmLabel: "Start",
      },
      async () => (await import("@senryo/account")).addRecoveryPasskey(client, new Date()),
    );
    if (!vault) return;
    download(vault);
    setSaved(true);
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
          For a provider that doesn't sync, or a move between Apple and Google: a second passkey plus a recovery file.
          The file is encrypted to that passkey — useless on its own.
        </p>
        <Button variant="outline" disabled={!ready} onClick={() => void addBackup()}>
          {saved ? <Download /> : <KeyRound />}
          {saved ? "Recovery file saved · add another" : "Add a backup passkey"}
        </Button>
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
