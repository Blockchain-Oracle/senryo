"use client";

/**
 * The account, shown large (F08 cross-platform proof: create on the phone, sign in here → the identical address).
 * Watch-link for judges (D-031). No account → the entry points, never a blank.
 */
import { explorerAddressUrl, WEB_ORIGIN } from "@senryo/config";
import { Check, Copy, ExternalLink, Eye, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Panel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES, watchHref } from "@/lib/constants/routes";

const CREDENTIAL_SHOWN = 10;
const COPIED_MS = 1_500;

export function IdentityPanel() {
  const account = useAccount();
  if (account.status === "loading") {
    return (
      <Panel className="grid gap-3 p-4" aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
      </Panel>
    );
  }
  const hint = account.hint;
  if (!hint) {
    return (
      <Panel className="grid gap-3 p-4">
        <p className="text-row">No account on this device</p>
        <p className="text-meta text-text-2">
          Create one with a passkey, or open the account you already have — the same passkey gives the same address on
          every device.
        </p>
        <Button asChild>
          <Link href={ROUTES.welcome}>
            <UserRoundPlus />
            Create or sign in
          </Link>
        </Button>
      </Panel>
    );
  }
  const shareUrl = `${WEB_ORIGIN}${watchHref(hint.address, ACTIVE_NETWORK.chainId)}`;
  return (
    <Panel className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-meta text-text-2">Your account</p>
        <span className="rounded-xs border border-primary/50 px-1.5 py-0.5 font-mono text-micro text-primary">
          {ACTIVE_NETWORK.modeLabel.toUpperCase()}
        </span>
      </div>
      <p className="break-all font-mono text-num-sm tracking-tight tnum" data-testid="account-address">
        {hint.address}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-meta text-text-2">
        <a
          href={explorerAddressUrl(ACTIVE_NETWORK.chainId, hint.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Explorer <ExternalLink className="size-3" aria-hidden />
        </a>
        <CopyText text={hint.address} label="Copy address" icon={<Copy className="size-3" aria-hidden />} />
        <CopyText text={shareUrl} label="Copy watch link" icon={<Eye className="size-3" aria-hidden />} />
        <span>
          {hint.mode === "vault" ? "Backup passkey" : "Passkey"} ·{" "}
          {hint.credential.credentialId.slice(0, CREDENTIAL_SHOWN)}…
        </span>
      </div>
    </Panel>
  );
}

/** Inline copy action with an in-place "Copied" state (no success toast, plan §2.5 state rules). */
function CopyText({ text, label, icon }: { text: string; label: string; icon: ReactNode }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {copied ? <Check className="size-3 text-up" aria-hidden /> : icon}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
