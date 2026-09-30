"use client";

/**
 * Welcome actions (F01 / F02 / F03 / F08, D-029). No hint → **Create account** is primary (one passkey ceremony),
 * "I already have an account" runs the discoverable sign-in. With a hint → continuing as that account is primary.
 * "Look around first" browses without an account. Cancel is silent; every failure names its fix.
 */
import { type AuthFailure, classifyAuthError, isSilent } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { ArrowRight, KeyRound, LifeBuoy, ScanFace, UserRoundPlus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ttftStart } from "@/lib/account/measure";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";
import type { CeremonyKind } from "./ceremony-card";
import { HostNotAllowed } from "./host-not-allowed";

// Loaded on first use: the ceremony trace (motion), failure card (QR) and recovery sheet (vaul/radix) stay out of the
// landing bundle (plan §2.4 landing budget).
const CeremonyCard = dynamic(() => import("./ceremony-card").then((m) => m.CeremonyCard), { ssr: false });
const AuthFailureCard = dynamic(() => import("./auth-failure").then((m) => m.AuthFailureCard), { ssr: false });
const RecoverSheet = dynamic(() => import("./recover-sheet").then((m) => m.RecoverSheet), { ssr: false });

type Phase =
  | { kind: "idle" }
  | { kind: "running"; flow: CeremonyKind }
  | { kind: "failed"; flow: CeremonyKind; failure: AuthFailure };

export function WelcomeActions() {
  const account = useAccount();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [recoverOpen, setRecoverOpen] = useState(false);

  useEffect(() => {
    if (account.status === "ready" && !account.hint) ttftStart(Date.now());
  }, [account.status, account.hint]);

  const run = async (flow: CeremonyKind, action: () => Promise<unknown>) => {
    setPhase({ kind: "running", flow });
    try {
      await action();
      router.push(ROUTES.portfolio);
    } catch (error) {
      const failure = classifyAuthError(error);
      setPhase(isSilent(failure) ? { kind: "idle" } : { kind: "failed", flow, failure });
    }
  };
  const create = () => run("create", account.create);
  const signIn = () => run("sign-in", account.signIn);
  const unlock = () => run("unlock", account.unlock);

  if (account.host === "not-allowed") return <HostNotAllowed />;
  if (phase.kind === "running")
    return <CeremonyCard kind={phase.flow} extraPrompt={account.extraPrompt !== undefined} />;
  if (phase.kind === "failed") {
    const retry = { create, "sign-in": signIn, unlock, recover: () => setRecoverOpen(true) }[phase.flow];
    return (
      <AuthFailureCard
        kind={phase.failure}
        flow={phase.flow}
        onRetry={() => void retry()}
        onSignIn={() => void signIn()}
        onCreate={() => void create()}
      />
    );
  }
  if (account.status === "loading") {
    return (
      <div className="space-y-3" aria-busy>
        <span className="sr-only">Loading your account</span>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const hint = account.hint;
  return (
    <div className="space-y-3">
      {hint ? (
        <>
          <Button size="lg" className="w-full" onClick={() => void unlock()}>
            <ScanFace />
            Continue · {shortAddress(hint.address)}
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={ROUTES.portfolio}>
              Open portfolio · locked
              <ArrowRight />
            </Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => void signIn()}>
            <KeyRound />
            Use a different account
          </Button>
        </>
      ) : (
        <>
          <Button size="lg" className="w-full" onClick={() => void create()}>
            <UserRoundPlus />
            Create account
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => void signIn()}>
            <KeyRound />I already have an account
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href={ROUTES.markets}>
              Look around first
              <ArrowRight />
            </Link>
          </Button>
        </>
      )}
      <p className="text-center font-mono text-micro text-muted-foreground uppercase tracking-[0.12em]">
        A passkey is your account · no seed phrase
      </p>
      <button
        type="button"
        onClick={() => setRecoverOpen(true)}
        className="mx-auto flex items-center gap-1.5 rounded-xs font-mono text-micro text-muted-foreground uppercase tracking-[0.12em] transition-colors duration-(--motion-fast) ease-desk hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <LifeBuoy className="size-3.5" aria-hidden />
        Recover with a backup passkey
      </button>
      {recoverOpen ? (
        <RecoverSheet open onOpenChange={setRecoverOpen} onRecovered={() => router.push(ROUTES.portfolio)} />
      ) : null}
    </div>
  );
}
