import { canonicalVoucherCode } from "@senryo/account";
import { useEffect, useState } from "react";
import { Button } from "~/components/kit/Button";
import { SetupField } from "~/features/setup/SetupField";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { useVoucher } from "~/features/setup/useVoucher";
import { fire } from "~/feedback/fire";
import type { StarterErrorCode } from "~/lib/account/starter";
import { readClipboard } from "~/lib/clipboard";
import { usd } from "~/lib/money";

const VOUCHER_MAX = 32;
/** The credited amount stays on screen this long before the step moves on. */
const CREDITED_HOLD_MS = 1_200;

const FAILED: Partial<Record<StarterErrorCode | "AUTH", string>> = {
  VOUCHER_INVALID: "That code isn’t valid",
  VOUCHER_USED: "That code has already been used",
  VOUCHER_CAP_REACHED: "All vouchers for this round have been used",
  RATE_LIMITED: "Too many tries. Wait a moment, then try again.",
  UNREACHABLE: "Couldn’t reach Senryo. Check your connection.",
  GEO_BLOCKED: "Vouchers aren’t available where you are",
  AUTH: "Face ID didn’t confirm. Try again.",
};

/**
 * Setup step 3 — a voucher code (C10 adapted, FT041/FT067; Fomo F07's code · Paste · "I don't have one" anatomy):
 * a Senryo voucher adds starting funds; the sponsor pays the gas. Optional — "I don't have one" and Skip both move on.
 * A redeemed voucher shows what was credited before the step advances.
 */
export default function VoucherStep() {
  const { next, back } = useSetupNav("voucher");
  const voucher = useVoucher();
  const [code, setCode] = useState("");
  const canonical = canonicalVoucherCode(code);
  const { phase } = voucher;

  useEffect(() => {
    if (phase.kind !== "done") return;
    fire("confirm");
    const id = setTimeout(next, CREDITED_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase.kind, next]);
  useEffect(() => {
    if (phase.kind === "failed") fire("fail");
  }, [phase.kind]);

  const message =
    phase.kind === "done"
      ? `${usd(phase.creditUsd6)} added to your account`
      : phase.kind === "failed"
        ? (FAILED[phase.code] ?? "Couldn’t redeem that code. Try again.")
        : undefined;
  return (
    <SetupScreen
      title="Have a voucher code?"
      body="A voucher adds starting funds to your account. We pay the network fee."
      onBack={back}
      onSkip={next}
      footer={
        <>
          <Button
            label="I don’t have one"
            variant="ghost"
            size="sm"
            disabled={phase.kind === "working"}
            onPress={next}
          />
          <Button
            label="Redeem"
            disabled={canonical === undefined || phase.kind === "done"}
            loading={phase.kind === "working"}
            onPress={() => void voucher.redeem(code)}
          />
        </>
      }
    >
      <SetupField
        label="Voucher code"
        value={code}
        onChangeText={(t) => {
          if (phase.kind === "failed") voucher.reset();
          setCode(t.toUpperCase());
        }}
        placeholder="Voucher code"
        action={{
          label: "Paste",
          onPress: () => void readClipboard().then((t) => setCode(t.trim().toUpperCase().slice(0, VOUCHER_MAX))),
        }}
        {...(message ? { message } : {})}
        tone={phase.kind === "done" ? "good" : phase.kind === "failed" ? "bad" : "quiet"}
        input={{ autoCapitalize: "characters", maxLength: VOUCHER_MAX, returnKeyType: "done" }}
      />
    </SetupScreen>
  );
}
