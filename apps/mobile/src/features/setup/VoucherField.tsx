/**
 * "Have a code?" on setup step 3 (A2; Fomo F07's code · Paste anatomy): the voucher field in place of the practice
 * card. Redeem signs in-session and the sponsor relays it; a pending redeem says so and offers only "Check status",
 * never a second send. "Use the free money" goes back to the card.
 */
import { canonicalVoucherCode } from "@senryo/account";
import { useQueryEnv } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import type { StarterErrorCode } from "~/lib/account/starter";
import { readClipboard } from "~/lib/clipboard";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { usd } from "~/lib/money";
import { useReviewGuard } from "~/lib/review-guard";
import { SetupField } from "./SetupField";
import { SetupScreen } from "./SetupScreen";
import { useVoucher } from "./useVoucher";

const VOUCHER_MAX = 32;
/** The credited amount stays on screen this long before the step moves on. */
const CREDITED_HOLD_MS = 1_200;

const FAILED: Partial<Record<StarterErrorCode | "AUTH", string>> = {
  VOUCHER_INVALID: "Not a valid code",
  VOUCHER_USED: "Already used",
  VOUCHER_CAP_REACHED: "This round is used up",
  RATE_LIMITED: "Too many tries · wait a moment",
  UNREACHABLE: "Couldn’t reach Senryo",
  GEO_BLOCKED: "Not available in your region",
  AUTH: "Face ID didn’t confirm · try again",
};

export function VoucherField({ onBack, onDone, back }: { onBack: () => void; onDone: () => void; back: () => void }) {
  const address = useAccount().hint?.address;
  const { chainId } = useQueryEnv();
  return <AccountVoucher key={`${chainId}:${address}`} onBack={onBack} onDone={onDone} back={back} />;
}

function AccountVoucher({ onBack, onDone, back }: { onBack: () => void; onDone: () => void; back: () => void }) {
  const voucher = useVoucher();
  const [pasteError, setPasteError] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [code, setCode] = useState("");
  const guard = useReviewGuard(code);
  const canonical = canonicalVoucherCode(code);
  const { phase } = voucher;

  useEffect(() => {
    if (phase.kind !== "done") return;
    fire("confirm");
    const id = setTimeout(onDone, CREDITED_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase.kind, onDone]);
  useEffect(() => {
    if (phase.kind === "failed") fire("fail");
  }, [phase.kind]);

  const message =
    phase.kind === "pending"
      ? "Pending · check status"
      : phase.kind === "done"
        ? `${usd(phase.creditUsd6)} added`
        : phase.kind === "failed"
          ? DEV_WORKSPACE && phase.code === "NOT_DEPLOYED"
            ? "Voucher relay isn’t available in this local workspace"
            : (FAILED[phase.code] ?? "Couldn’t redeem · try again")
          : pasteError
            ? "Couldn’t paste · try again"
            : undefined;
  return (
    <SetupScreen
      step="money"
      title="Enter your voucher code"
      body="Optional · redeem practice money with a valid code"
      onBack={phase.kind === "working" ? undefined : back}
      onSkip={phase.kind === "working" ? undefined : onDone}
      footer={
        <>
          <Button
            label="I don’t have a code"
            variant="ghost"
            size="sm"
            disabled={phase.kind === "working" || phase.kind === "pending"}
            onPress={onBack}
          />
          <Button
            label={phase.kind === "pending" ? "Check status" : "Redeem"}
            disabled={(phase.kind !== "pending" && canonical === undefined) || phase.kind === "done"}
            loading={phase.kind === "working"}
            onPress={() => void voucher.redeem(code, guard)}
          />
        </>
      }
    >
      <SetupField
        label="Voucher code"
        value={code}
        onChangeText={(t) => {
          if (phase.kind === "failed") voucher.reset();
          setPasteError(false);
          setCode(t.toUpperCase());
        }}
        placeholder="Voucher code"
        action={{
          label: "Paste",
          onPress: () =>
            void readClipboard()
              .then((t) => {
                if (!alive.current) return;
                setPasteError(false);
                if (phase.kind === "failed") voucher.reset();
                setCode(t.trim().toUpperCase().slice(0, VOUCHER_MAX));
              })
              .catch(() => {
                if (alive.current) setPasteError(true);
              }),
        }}
        {...(message ? { message } : {})}
        tone={phase.kind === "done" ? "good" : phase.kind === "failed" ? "bad" : "quiet"}
        input={{
          autoCapitalize: "characters",
          maxLength: VOUCHER_MAX,
          returnKeyType: "done",
          editable: phase.kind !== "working" && phase.kind !== "pending",
        }}
      />
    </SetupScreen>
  );
}
