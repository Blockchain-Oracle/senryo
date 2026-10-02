"use client";

/**
 * Setup (flow book A2, A11; the phone's setup steps, folded into one page on the web): the handle with its live check
 * (available / taken / reserved / on hold / not allowed), "Show my trades" per mode with the shared address stated, and
 * the terms — the one step that can't be skipped. Saving the handle uses the api session (one passkey prompt when
 * locked, on Save only). `?next=` returns to the action that asked for the terms.
 */
import { HANDLE_MAX_CHARS, type HandleAvailability } from "@senryo/api-client";
import { useHandleAvailability, useSaveProfile } from "@senryo/query";
import { Check, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { acknowledgeTerms, useTermsAccepted } from "@/lib/account/terms";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { ROUTES } from "@/lib/constants/routes";
import { socialErrorCopy } from "@/lib/social/format";
import { cn } from "@/lib/utils";

const INVALID: Record<NonNullable<HandleAvailability["reason"]>, string> = {
  length: "4–20 characters",
  charset: "Letters, numbers, _ only",
  blocked: "Not allowed",
};

function handleLine(a: HandleAvailability): { text: string; good: boolean } {
  switch (a.state) {
    case "available":
      return { text: `@${a.handle} is available`, good: true };
    case "taken":
      return { text: "Taken", good: false };
    case "reserved":
      return { text: "Reserved", good: false };
    case "held":
      return { text: "On hold", good: false };
    case "invalid":
      return { text: INVALID[a.reason ?? "charset"], good: false };
  }
}

/** Only in-app paths, never `//host` or a scheme (flow book G2 rule). */
const safeNext = (next: string | null) => (next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.home);

function Chip({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "h-9 rounded-full px-4 text-meta",
        on ? "bg-foreground text-background" : "bg-raised-2 text-text-2",
      )}
    >
      {label}
    </button>
  );
}

export function SetupScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const account = useAccount();
  const address = account.hint?.address;
  const session = useSessionRunner();
  const accepted = useTermsAccepted(address);
  const save = useSaveProfile(address, session);
  const handleId = useId();
  const [handle, setHandle] = useState("");
  const [practice, setPractice] = useState(true);
  const [mainnet, setMainnet] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string>();
  const availability = known(useHandleAvailability(handle.trim() === "" ? undefined : handle));
  const line = availability ? handleLine(availability) : undefined;
  const agreed = accepted || terms;

  if (!address)
    return (
      <Column>
        <PageHeader title="Setup" back={ROUTES.home} />
        <div className="grid gap-3 py-6 text-center">
          <p className="text-row">Create an account first</p>
          <Button asChild size="xl">
            <Link href={ROUTES.welcome}>Create account</Link>
          </Button>
        </div>
      </Column>
    );

  const finish = async (withHandle: boolean) => {
    setError(undefined);
    if (!agreed) return;
    if (!accepted) acknowledgeTerms(address);
    if (withHandle) {
      try {
        await save.mutateAsync({
          handle: handle.trim().replace(/^@/, "").toLowerCase(),
          listedPractice: true,
          publicTradesPractice: practice,
          publicTradesMainnet: mainnet,
        });
      } catch (e) {
        setError(socialErrorCopy(e, "Couldn’t save · try again"));
        return;
      }
    }
    router.push(next);
  };

  return (
    <Column>
      <PageHeader title="Setup" back={ROUTES.home} />
      <div className="grid gap-6 pt-2">
        <section className="grid gap-2">
          <label htmlFor={handleId} className="text-section-title">
            Your handle
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3">@</span>
            <Input
              id={handleId}
              value={handle}
              maxLength={HANDLE_MAX_CHARS + 1}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              autoComplete="off"
              spellCheck={false}
              placeholder="handle"
              className="pl-7"
            />
          </div>
          {line ? (
            <p className={cn("flex items-center gap-1 text-meta", line.good ? "text-up" : "text-down")}>
              {line.good ? <Check className="size-4" aria-hidden /> : null}
              {line.text}
            </p>
          ) : null}
        </section>
        <section className="grid gap-2">
          <p className="flex items-center gap-1 text-section-title">
            Show my trades
            <span title="One address on both modes: Practice and Mainnet are listed separately">
              <Info className="size-4 text-text-3" aria-label="One address on both modes" />
            </span>
          </p>
          <div className="flex gap-2">
            <Chip on={practice} label="Practice" onToggle={() => setPractice(!practice)} />
            <Chip on={mainnet} label="Mainnet" onToggle={() => setMainnet(!mainnet)} />
          </div>
        </section>
        <label className="flex items-start gap-3 rounded-md bg-raised-2 p-4 text-row">
          <input
            type="checkbox"
            checked={agreed}
            disabled={accepted}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms/" className="text-link hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy/" className="text-link hover:underline">
              Privacy
            </Link>
          </span>
        </label>
        {error ? <p className="text-meta text-down">{error}</p> : null}
        <div className="grid gap-2">
          <Button size="xl" disabled={!agreed || !line?.good || save.isPending} onClick={() => void finish(true)}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save and continue
          </Button>
          <Button variant="ghost" className="font-sans" disabled={!agreed} onClick={() => void finish(false)}>
            Skip handle
          </Button>
        </div>
      </div>
    </Column>
  );
}
