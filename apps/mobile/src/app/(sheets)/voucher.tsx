import { canonicalVoucherCode } from "@senryo/account";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SetupField } from "~/features/setup/SetupField";
import { useVoucher, type VoucherPhase } from "~/features/setup/useVoucher";
import { fire } from "~/feedback/fire";
import type { StarterErrorCode } from "~/lib/account/starter";
import { readClipboard } from "~/lib/clipboard";
import { usd } from "~/lib/money";
import { SPACE } from "~/theme";

const VOUCHER_MAX = 32;
/** The credited amount stays on screen this long before the sheet closes. */
const CREDITED_HOLD_MS = 1_400;

const FAILED: Partial<Record<StarterErrorCode | "AUTH", string>> = {
  VOUCHER_INVALID: "That code isn’t valid",
  VOUCHER_USED: "That code has already been used",
  VOUCHER_CAP_REACHED: "All vouchers for this round have been used",
  RATE_LIMITED: "Too many tries. Wait a moment, then try again.",
  UNREACHABLE: "Couldn’t reach Senryo. Check your connection.",
  GEO_BLOCKED: "Vouchers aren’t available where you are",
  NOT_DEPLOYED: "Vouchers aren’t live on this network yet",
  AUTH: "Face ID didn’t confirm. Try again.",
};

function messageOf(phase: VoucherPhase): string | undefined {
  if (phase.kind === "done") return `${usd(phase.creditUsd6)} added to your account`;
  if (phase.kind === "failed") return FAILED[phase.code] ?? "Couldn’t redeem that code. Try again.";
  return undefined;
}

/**
 * Redeem a voucher (FT041/FT067; the add-money hub's child, F21 pattern): the code field with Paste, every failure
 * named in the field's own line, the credited amount shown before the sheet closes. The sponsor relays it; the user
 * pays no gas. Signing in first is required (a voucher credits an account).
 */
function Body() {
  const close = useSheetClose();
  const voucher = useVoucher();
  const [code, setCode] = useState("");
  const { phase } = voucher;
  useEffect(() => {
    if (phase.kind === "done") {
      fire("filled", { sound: "deposit" });
      const id = setTimeout(() => close(), CREDITED_HOLD_MS);
      return () => clearTimeout(id);
    }
    if (phase.kind === "failed") fire("fail");
  }, [phase.kind, close]);
  const message = messageOf(phase);
  return (
    <>
      <SheetHeading title="Redeem a voucher" body="A voucher adds funds to your account. We pay the network fee." />
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
      <View style={{ gap: SPACE.sm }}>
        <Button
          label="Redeem"
          disabled={canonicalVoucherCode(code) === undefined || phase.kind === "done"}
          loading={phase.kind === "working"}
          onPress={() => void voucher.redeem(code)}
        />
      </View>
    </>
  );
}

export default function VoucherSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close voucher">
      <Body />
    </Sheet>
  );
}
