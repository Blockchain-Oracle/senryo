import { ApiError } from "@senryo/api-client";
import { useHandleAvailability, useSaveProfile } from "@senryo/query";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/kit/Button";
import { type FieldTone, SetupField } from "~/features/setup/SetupField";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { suggestHandle } from "~/features/setup/suggest-handle";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";

/** The availability check waits for the typing to pause. */
const CHECK_DELAY_MS = 300;
const HANDLE_MAX = 20;

const INVALID: Record<string, string> = {
  length: "Use 4 to 20 characters",
  charset: "Letters, numbers and underscores only",
  blocked: "That name can’t be used",
};

/**
 * Setup step 1 — the @handle (C09; Fomo F04/F05, Phantom P05–P08): a suggested handle to start from, checked as it is
 * typed, with every state in the same reserved line (checking · available · taken · held · invalid · couldn't check).
 * Continue claims it; Skip leaves the account without one (it can be set later in You).
 */
export default function HandleStep() {
  const { next, address } = useSetupNav("handle");
  const session = useSessionRunner();
  const [text, setText] = useState(() => suggestHandle(address));
  const [settled, setSettled] = useState(text);
  const [saveError, setSaveError] = useState<string>();
  const touched = useRef(false);
  // The address can arrive after the first frame (a resumed setup): offer the suggestion then, unless already typing.
  useEffect(() => {
    if (!touched.current && address) setText((t) => (t === "" ? suggestHandle(address) : t));
  }, [address]);
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);
  const check = useHandleAvailability(settled);
  const save = useSaveProfile(address, session);

  const typing = settled !== text;
  const known = check.status === "fresh" || check.status === "stale" ? check.value : undefined;
  const available = !typing && known?.state === "available";
  let message: string | undefined;
  let tone: FieldTone = "quiet";
  if (saveError) {
    message = saveError;
    tone = "bad";
  } else if (text === "") {
    message = undefined;
  } else if (typing || check.status === "unknown") {
    message = "Checking…";
  } else if (check.status === "failed") {
    message = "Couldn’t check that name. Check your connection.";
    tone = "bad";
  } else if (known?.state === "available") {
    message = `@${known.handle} is available`;
    tone = "good";
  } else if (known?.state === "invalid") {
    message = INVALID[known.reason ?? "charset"];
    tone = "bad";
  } else if (known?.state === "held") {
    message = "That name was released recently and is on hold";
    tone = "bad";
  } else {
    message = "That name is taken";
    tone = "bad";
  }

  const claim = () => {
    if (!known) return;
    setSaveError(undefined);
    save.mutate(
      { handle: known.handle },
      {
        onSuccess: () => {
          fire("confirm");
          next();
        },
        onError: (error) => {
          fire("fail");
          const taken = error instanceof ApiError && (error.code === "HANDLE_TAKEN" || error.code === "HANDLE_HELD");
          setSaveError(taken ? "Someone just took that name. Try another." : "Couldn’t save that name. Try again.");
        },
      },
    );
  };

  return (
    <SetupScreen
      title="Create your username"
      body="It’s how people find and follow you. You can change it later."
      onSkip={next}
      footer={<Button label="Continue" disabled={!available} loading={save.isPending} onPress={claim} />}
    >
      <SetupField
        label="Username"
        value={text}
        onChangeText={(t) => {
          touched.current = true;
          setSaveError(undefined);
          setText(t.toLowerCase());
        }}
        placeholder="username"
        prefix="@"
        {...(text
          ? {
              action: {
                label: "Clear",
                onPress: () => {
                  touched.current = true;
                  setText("");
                },
              },
            }
          : {})}
        {...(message ? { message } : {})}
        tone={tone}
        input={{ autoCapitalize: "none", maxLength: HANDLE_MAX, returnKeyType: "done" }}
      />
    </SetupScreen>
  );
}
