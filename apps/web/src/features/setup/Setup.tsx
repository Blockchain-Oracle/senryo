"use client";
/**
 * First run on the web (the phone's setup, S5.7, without the phone-only steps — notifications and Face ID): passkey →
 * the @username → the terms → test dollars (granted on arrival) → the first call in the live terminal → one-tap calls.
 * Each step can be skipped but the terms (no money moves before them); where you stopped is remembered per account
 * in this browser, and the first call is the celebration — there is no separate "done" page.
 */
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { OneTapChip } from "@/features/home/OneTapChip";
import { useAccount } from "@/lib/account/provider";
import { acknowledgeTerms, useTermsAccepted } from "@/lib/account/terms";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { ROUTES } from "@/lib/constants/routes";
import { fire } from "@/lib/feedback";
import { money } from "@/lib/format";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { useStoredString } from "@/lib/terminal/stored";
import { HandleStep } from "./HandleStep";

export const WEB_SETUP_STEPS = ["handle", "terms", "dollars", "first-call", "one-tap"] as const;
type Step = (typeof WEB_SETUP_STEPS)[number];

const COPY: Record<Step, { title: string; body: string }> = {
  handle: { title: "Pick your username", body: "How you show up on calls and the leaderboard." },
  terms: { title: "Before any money moves", body: "Senryo is a prediction market: a call can lose its whole stake." },
  dollars: { title: "Test dollars", body: "Free dollars to call with, on Monad's test network." },
  "first-call": { title: "Call the next move", body: "Up or Down on a live price; the window closes on its own." },
  "one-tap": {
    title: "One-tap calls",
    body: "Calls up to small caps with no prompt each time; caps enforced on chain.",
  },
};

function DollarsStep({ onDone }: { onDone: () => void }) {
  const address = useAccount().hint?.address;
  const session = useSessionRunner();
  const grant = usePracticeGrant(address, session);
  const account = useMarketAccount(address);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !session || !address) return;
    asked.current = true;
    grant.mutate(undefined, { onSuccess: (r) => r.state === "granted" && fire("filled", { cue: "win" }) });
  }, [session, address, grant]);
  const r = grant.data;
  const amount = r?.state === "granted" ? r.amount : "value" in account ? account.value.balance : undefined;
  return (
    <div className="flex flex-col gap-4">
      <p className="tnum font-semibold text-display-balance">{amount === undefined ? "$—" : money(amount)}</p>
      <p className="text-meta text-text-3">
        {grant.isPending
          ? "Adding your test dollars…"
          : grant.isError
            ? "Couldn't add them just now"
            : r?.state === "already"
              ? "Already in your Practice balance"
              : "In your Practice balance"}
      </p>
      {grant.isError ? (
        <Button variant="secondary" size="xl" onClick={() => grant.mutate()}>
          Try again
        </Button>
      ) : null}
      <Button size="xl" disabled={grant.isPending} onClick={onDone}>
        Continue
      </Button>
    </div>
  );
}

/** Setup was finished in this browser: straight on to Home. */
function Finished() {
  const router = useRouter();
  useEffect(() => router.replace(ROUTES.app), [router]);
  return null;
}

export function Setup() {
  const router = useRouter();
  const account = useAccount();
  const address = account.hint?.address;
  const [stored, setStored] = useStoredString(`senryo.setup.${address?.toLowerCase() ?? "guest"}.v1`);
  const termsOk = useTermsAccepted(address);
  const resumed: Step = WEB_SETUP_STEPS.find((s) => s === stored) ?? "handle";
  const pastTerms = stored === "done" || WEB_SETUP_STEPS.indexOf(resumed) > WEB_SETUP_STEPS.indexOf("terms");
  // New terms (a version bump) are agreed before anything else, then setup carries on where it was.
  const step: Step = pastTerms && !termsOk ? "terms" : resumed;
  const next = () => {
    const i = WEB_SETUP_STEPS.indexOf(step);
    const following = WEB_SETUP_STEPS[i + 1];
    if (following) setStored(following);
    else {
      setStored("done");
      router.push(ROUTES.app);
    }
  };

  if (account.status === "loading") return <p className="text-body text-text-3">Loading your account…</p>;
  if (!address)
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="font-semibold text-page-title">Set up Senryo</h1>
        <Button size="xl" onClick={() => openDrawer(DRAWERS.account)}>
          Create account
        </Button>
      </div>
    );
  if (stored === "done" && termsOk) return <Finished />;
  const copy = COPY[step];
  const index = WEB_SETUP_STEPS.indexOf(step);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      <ol className="flex gap-1.5" aria-label={`Step ${index + 1} of ${WEB_SETUP_STEPS.length}`}>
        {WEB_SETUP_STEPS.map((s, i) => (
          <li
            key={s}
            aria-hidden
            className={i <= index ? "h-1 flex-1 rounded-full bg-foreground" : "h-1 flex-1 rounded-full bg-secondary"}
          />
        ))}
      </ol>
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-page-title">{copy.title}</h1>
        <p className="text-body text-text-2">{copy.body}</p>
      </header>
      {step === "handle" ? <HandleStep onDone={next} /> : null}
      {step === "terms" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-2">
            Read the{" "}
            <a className="text-link underline" href={ROUTES.terms} target="_blank" rel="noopener noreferrer">
              terms
            </a>{" "}
            and the{" "}
            <a className="text-link underline" href={ROUTES.privacy} target="_blank" rel="noopener noreferrer">
              privacy notice
            </a>
            . Practice uses test dollars with no value; Real uses USDC.
          </p>
          <Button
            size="xl"
            onClick={() => {
              acknowledgeTerms(address);
              fire("confirm", { cue: "tap" });
              if (!pastTerms) next();
            }}
          >
            I agree
          </Button>
        </div>
      ) : null}
      {step === "dollars" ? <DollarsStep onDone={next} /> : null}
      {step === "first-call" ? (
        <div className="flex flex-col gap-3">
          <Button
            size="xl"
            onClick={() => {
              next();
              router.push("/app/trade/btc/");
            }}
          >
            Open the terminal
          </Button>
          <Button variant="ghost" onClick={next}>
            Later
          </Button>
        </div>
      ) : null}
      {step === "one-tap" ? (
        <div className="flex flex-col gap-3">
          <OneTapChip />
          <Button size="xl" onClick={next}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}
