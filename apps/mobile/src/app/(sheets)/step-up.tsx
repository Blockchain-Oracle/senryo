import { type AuthFailure, authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Text } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { AuthCard } from "~/features/auth/AuthCard";
import { fire } from "~/feedback/fire";
import { type StepUpRequest, useStepUpRequest } from "~/lib/account/step-up";
import { UNLOCK_WORD } from "~/lib/constants/auth";
import { TYPE, useTheme } from "~/theme";

/**
 * Step-up (spec session-policy §5): what is being approved, then one fresh Face ID read of the account's unlock item
 * (the passkey ceremony only when that item is gone, D-255) — never the live session. Opened by `requestStepUp`; a
 * direct deep link with nothing pending just explains the rule.
 */
function Body({ request }: { request: StepUpRequest | undefined }) {
  const { color } = useTheme();
  const close = useSheetClose();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure>();
  const settled = useRef(false);

  useEffect(
    () => () => {
      // Dismissed by drag/scrim/back without confirming: the caller gets `undefined` (cancel is silent).
      if (!settled.current) request?.settle(undefined);
    },
    [request],
  );

  if (!request) {
    return (
      <AuthCard
        glyph="faceId"
        tone="gold"
        title={`Confirm with ${UNLOCK_WORD}`}
        body={`Withdrawals, sends, card limits, your recovery phrase and looser security settings always ask for ${UNLOCK_WORD} again.`}
      >
        <Button label="Close" variant="outline" onPress={() => close()} />
      </AuthCard>
    );
  }
  const confirm = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      const value = await request.action();
      settled.current = true;
      fire("confirm");
      close(() => request.settle(value));
    } catch (error) {
      setBusy(false);
      const kind = classifyAuthError(error);
      if (isSilent(kind)) return;
      if (kind === "unknown" && !(error instanceof Error && error.name === "AuthError")) {
        settled.current = true;
        close(() => request.fail(error));
        return;
      }
      fire("fail");
      setFailure(kind);
    }
  };
  const copy = failure ? authFailureCopy(failure, Platform.OS === "ios" ? "ios" : "android") : undefined;
  return (
    <AuthCard
      glyph="faceId"
      tone="gold"
      title={request.intent.title}
      body={request.intent.detail}
      {...(copy ? {} : { footer: "Always asked, never inside a trading session." })}
    >
      {copy ? (
        <Text accessibilityRole="alert" style={[TYPE.rowDetail, { color: color.down, textAlign: "center" }]}>
          {copy.title}. {copy.body}
        </Text>
      ) : null}
      <Button
        label={busy ? "Confirming…" : (request.intent.confirmLabel ?? `Confirm with ${UNLOCK_WORD}`)}
        loading={busy}
        onPress={() => void confirm()}
      />
      <Button label="Cancel" variant="ghost" size="sm" disabled={busy} onPress={() => close()} />
    </AuthCard>
  );
}

export default function StepUpSheet() {
  const request = useStepUpRequest();
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close confirmation">
      <Body request={request} />
    </Sheet>
  );
}
