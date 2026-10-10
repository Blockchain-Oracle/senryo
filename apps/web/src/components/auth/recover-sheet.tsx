"use client";

/**
 * F07/F08 recovery with a **backup passkey** (D-034, D-153): Senryo's encrypted copy (`GET /v1/vault/:credentialId`) —
 * the backup passkey identifies itself, its vault is fetched, then opened behind that same passkey (two prompts) — or
 * the recovery file when Senryo can't be reached. Either way the vault is the account's root AES-GCM-encrypted under
 * the backup passkey's PRF: useless without it.
 */
import { authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { FileKey2, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useAccount } from "@/lib/account/provider";

type Source = "server" | "file";
type State = { kind: "idle" } | { kind: "busy" } | { kind: "error"; title: string; body: string };

const NO_VAULT = {
  title: "That passkey has no backup on Senryo",
  body: "It may be your main passkey — use “I already have an account” instead, or open your recovery file.",
};
const OFFLINE = {
  title: "Senryo can't be reached right now",
  body: "Open your recovery file instead — it's the same backup.",
};
const BAD_FILE = {
  title: "That file isn't a Senryo recovery file",
  body: "Pick the .json you saved when you added a backup passkey.",
};

function copyFor(error: unknown, source: Source) {
  const name = error instanceof Error ? error.name : "";
  if (name === "VaultNotFoundError") return NO_VAULT;
  if (name === "ApiError" || name === "TypeError") return OFFLINE;
  if (source === "file" && error instanceof Error && /vault|VAULT/.test(`${name} ${error.message}`)) return BAD_FILE;
  return authFailureCopy(classifyAuthError(error), "web");
}

export function RecoverSheet({
  open,
  onOpenChange,
  onRecovered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecovered: () => void;
}) {
  const account = useAccount();
  const inputId = useId();
  const [source, setSource] = useState<Source>("server");
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "busy";

  const recover = async () => {
    const client = account.client;
    if (!client || (source === "file" && !file)) return;
    setState({ kind: "busy" });
    try {
      const { recoverWithServerVault, recoverWithVault } = await import("@senryo/account");
      if (source === "file" && file) await recoverWithVault(client, await file.text());
      else await recoverWithServerVault(client, (await import("@/lib/account/remote")).fetchVault);
      await account.refresh();
      onOpenChange(false);
      onRecovered();
    } catch (error) {
      if (isSilent(classifyAuthError(error))) return setState({ kind: "idle" });
      setState({ kind: "error", ...copyFor(error, source) });
    }
  };

  const switchTo = (next: Source) => {
    setSource(next);
    setState({ kind: "idle" });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      locked={busy}
      title="Recover with a backup passkey"
      description={
        source === "server"
          ? "Confirm with your backup passkey — Senryo finds its encrypted backup, then the same passkey opens it."
          : "Choose your recovery file, then confirm with the backup passkey it was made for."
      }
      footer={
        <div className="grid w-full gap-2">
          <Button
            className="w-full"
            disabled={busy || !account.client || (source === "file" && !file)}
            onClick={() => void recover()}
          >
            {busy ? <Loader2 className="animate-spin" /> : source === "server" ? <PasskeyGlyph /> : <FileKey2 />}
            {busy ? "Waiting for your passkey…" : "Open my account"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => switchTo(source === "server" ? "file" : "server")}
          >
            {source === "server" ? "Use a recovery file instead" : "Find my backup on Senryo instead"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-2 pb-2">
        {source === "file" ? (
          <>
            <Label htmlFor={inputId}>Recovery file</Label>
            <input
              id={inputId}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                setFile(e.target.files?.[0]);
                setState({ kind: "idle" });
              }}
              className="block w-full cursor-pointer rounded-sm border border-input bg-transparent p-2 font-mono text-caption file:mr-3 file:rounded-xs file:border-0 file:bg-secondary file:px-2 file:py-1 file:font-mono file:text-caption file:text-secondary-foreground"
            />
          </>
        ) : null}
        {state.kind === "error" ? (
          <p role="alert" className="text-caption text-destructive">
            <span className="font-medium">{state.title}.</span> {state.body}
          </p>
        ) : (
          <p className="text-caption text-muted-foreground">
            {source === "server"
              ? "Pick the backup passkey (not your main one) when asked. Two confirmations: one to find the backup, one to open it."
              : "The file alone opens nothing — it needs the backup passkey."}
          </p>
        )}
      </div>
    </Modal>
  );
}
