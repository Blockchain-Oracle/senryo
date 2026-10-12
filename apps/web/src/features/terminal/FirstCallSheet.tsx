"use client";
/**
 * A guest's first call (F14, the owner's video: "Show the product first. Ask for a signature only when there's
 * something to sign"; `feedback-value-first-sign-last`): the call they just picked, in one sheet — "Place $5 on BTC Up",
 * what it pays, the Terms as one line — whose button makes their passkey and places that same call. The passkey is the
 * signing step, not a login wall: the terms are agreed by placing it, the test dollars arrive on their own, and the
 * call goes through once they land, no re-tap. An existing passkey signs in the same way.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import type { OfferSlot } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useMarketAccount, usePracticeGrant } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { LiveText } from "@/components/kit/live-text";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAccount } from "@/lib/account/provider";
import { acknowledgeTerms } from "@/lib/account/terms";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { ROUTES } from "@/lib/constants/routes";
import { fire } from "@/lib/feedback";
import type { LiveValue } from "@/lib/terminal/live-value";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface FirstCallRequest {
  slot: OfferSlot;
  symbol: string;
  /** "Up", "Moonshot"… */
  label: string;
  stake: bigint;
  pays: LiveValue<string>;
}

type Phase = "idle" | "passkey" | "dollars" | "placing" | "short" | "failed";

const STATUS: Partial<Record<Phase, string>> = {
  passkey: "Making your passkey…",
  dollars: "Adding your test dollars…",
  placing: "Placing your call…",
  short: "Your test dollars are on the way. Try again in a moment.",
  failed: "That didn't go through. Try again.",
};

export function FirstCallSheet({
  request,
  onClose,
  onPlace,
}: {
  request: FirstCallRequest | null;
  onClose: () => void;
  /** Places the picked call (the terminal's own flow, now with an account). */
  onPlace: (slot: OfferSlot) => void;
}) {
  const account = useAccount();
  const address = account.hint?.address;
  const session = useSessionRunner();
  const grant = usePracticeGrant(address, session);
  const market = useMarketAccount(address);
  const [phase, setPhase] = useState<Phase>("idle");
  const asked = useRef(false);
  const place = useRef(onPlace);
  place.current = onPlace;

  useEffect(() => {
    if (request) {
      setPhase("idle");
      asked.current = false;
    }
  }, [request]);

  // The dollars: asked once a session exists (an account that already has them answers "already").
  useEffect(() => {
    if (phase !== "dollars" || !session || asked.current) return;
    asked.current = true;
    grant.mutate(undefined, { onError: () => undefined });
  }, [phase, session, grant]);

  // The call goes through as soon as the balance covers it; short of it once the grant answered, say so.
  const balance = "value" in market ? market.value.balance : undefined;
  useEffect(() => {
    if (phase !== "dollars" || !request || balance === undefined) return;
    if (balance >= request.stake) {
      setPhase("placing");
      place.current(request.slot);
      onClose();
    } else if (grant.isSuccess || grant.isError) {
      setPhase("short");
    }
  }, [phase, request, balance, grant.isSuccess, grant.isError, onClose]);

  const begin = async (how: "create" | "signIn") => {
    fire("press", { cue: "tap" });
    setPhase("passkey");
    try {
      const owner = how === "create" ? await account.create() : await account.signIn();
      acknowledgeTerms(owner);
      setPhase("dollars");
    } catch (error) {
      setPhase(isSilent(classifyAuthError(error)) ? "idle" : "failed");
    }
  };

  const busy = phase === "passkey" || phase === "dollars" || phase === "placing";
  return (
    <Modal
      open={request !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
      title={request ? `Place ${dollars(request.stake)} on ${request.symbol} ${request.label}` : ""}
      description="Your passkey makes your account and signs this call. No seed phrase, no wallet."
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" disabled={busy} onClick={() => void begin("create")}>
            Make my passkey &amp; place it
          </Button>
          <Button size="lg" variant="ghost" disabled={busy} onClick={() => void begin("signIn")}>
            I have a passkey
          </Button>
        </div>
      }
    >
      {request ? (
        <div className="flex flex-col gap-3">
          <LiveText value={request.pays} className="tnum font-semibold text-section-title" />
          <p className="text-meta text-text-3">
            Practice uses free test dollars. Placing it agrees to the{" "}
            <a href={ROUTES.terms} className="underline" target="_blank" rel="noreferrer">
              Terms
            </a>
            : a call can lose its whole stake.
          </p>
          {STATUS[phase] ? (
            <p role="status" aria-live="polite" className="text-body text-text-2">
              {STATUS[phase]}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
