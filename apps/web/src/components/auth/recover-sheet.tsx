"use client";

/**
 * F07/F08 recovery with a **backup passkey** (D-034): the recovery file (a Mera secret vault — the account's root,
 * AES-GCM-encrypted under the backup passkey's PRF; safe to keep anywhere) + that passkey open the same account on
 * any device. S6.12 adds the server copy (S3 `GET /v1/vault/:credentialId`) so no file is needed.
 */
import { authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { FileKey2, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useAccount } from "@/lib/account/provider";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "error"; title: string; body: string };

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
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<State>({ kind: "idle" });

  const recover = async () => {
    if (!file || !account.client) return;
    setState({ kind: "busy" });
    try {
      const { recoverWithVault } = await import("@senryo/account");
      await recoverWithVault(account.client, await file.text());
      await account.refresh();
      onOpenChange(false);
      onRecovered();
    } catch (error) {
      const kind = classifyAuthError(error);
      if (isSilent(kind)) return setState({ kind: "idle" });
      const vaultBroken = error instanceof Error && /vault|VAULT/.test(`${error.name} ${error.message}`);
      setState({
        kind: "error",
        ...(vaultBroken
          ? {
              title: "That file isn't a Senryo recovery file",
              body: "Pick the .json you saved when you added a backup passkey.",
            }
          : authFailureCopy(kind, "web")),
      });
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      locked={state.kind === "busy"}
      title="Recover with a backup passkey"
      description="Choose your recovery file, then confirm with the backup passkey it was made for."
      footer={
        <Button
          className="w-full"
          disabled={!file || state.kind === "busy" || !account.client}
          onClick={() => void recover()}
        >
          {state.kind === "busy" ? <Loader2 className="animate-spin" /> : <FileKey2 />}
          {state.kind === "busy" ? "Waiting for your passkey…" : "Open my account"}
        </Button>
      }
    >
      <div className="grid gap-2 pb-2">
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
        {state.kind === "error" ? (
          <p role="alert" className="text-caption text-down">
            <span className="font-medium">{state.title}.</span> {state.body}
          </p>
        ) : (
          <p className="text-caption text-muted-foreground">
            The file alone opens nothing — it needs the backup passkey. Keep it somewhere you'll find it (iCloud Drive,
            Google Drive, email to yourself).
          </p>
        )}
      </div>
    </ResponsiveSheet>
  );
}
