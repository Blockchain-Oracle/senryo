import { ApiError, normalizeHandle } from "@senryo/api-client";
import { socialKeys, useHandleAvailability, useSaveProfile } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { HELD_INFO, handleLine } from "~/features/profile/handle-copy";
import { DEFAULT_VISIBILITY, ShowTrades } from "~/features/profile/ShowTrades";
import type { Visibility } from "~/features/profile/VisibilitySettings";
import { InfoTip } from "~/features/setup/InfoTip";
import { type FieldTone, SetupField } from "~/features/setup/SetupField";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { suggestHandle } from "~/features/setup/suggest-handle";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { SPACE, TYPE, useTheme } from "~/theme";

/** The availability check waits for the typing to pause. */
const CHECK_DELAY_MS = 300;
const HANDLE_MAX = 20;

/**
 * Setup step 1 — the @username (A2; Fomo F04/F05): a suggested name to start from, checked as it is typed, every state
 * in the field's own line (Checking… · @kai is available · Taken · Reserved · On hold ⓘ · 4–20 characters · Not
 * allowed · Couldn't check · Retry). Under it, "Show my trades" with Practice (on) and Mainnet (off) chips and the
 * shared-address ⓘ (decision 11): Continue saves the name and all four visibility flags explicitly. Skip leaves the
 * account without a name (Home offers "Pick a username").
 */
export default function HandleStep() {
  const address = useAccount().hint?.address;
  return <AccountHandle key={address ?? "guest"} />;
}

function AccountHandle() {
  const { color } = useTheme();
  const { next, address } = useSetupNav("handle");
  const session = useSessionRunner();
  const [text, setText] = useState(() => suggestHandle(address));
  const [settled, setSettled] = useState(text);
  const [saveError, setSaveError] = useState<string>();
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);
  const touched = useRef(false);
  const alive = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The address can arrive after the first frame (a resumed setup): offer the suggestion then, unless already typing.
  useEffect(() => {
    if (!touched.current && address) setText((t) => (t === "" ? suggestHandle(address) : t));
  }, [address]);
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);
  const check = useHandleAvailability(settled);
  const client = useQueryClient();
  const recheck = () => void client.invalidateQueries({ queryKey: socialKeys.handle(normalizeHandle(settled)) });
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
    message = "Couldn’t check · Retry";
    tone = "bad";
  } else if (known) {
    ({ message, tone } = handleLine(known));
  }

  const claim = () => {
    if (!available || !known || save.isPending || submitting.current) return;
    submitting.current = true;
    setSaveError(undefined);
    save.mutate(
      { handle: known.handle, ...visibility },
      {
        onSuccess: () => {
          submitting.current = false;
          if (!alive.current) return;
          fire("confirm");
          next();
        },
        onError: (error) => {
          submitting.current = false;
          if (!alive.current) return;
          fire("fail");
          setSaveError(
            error instanceof ApiError && error.code === "HANDLE_HELD"
              ? "On hold · try another"
              : error instanceof ApiError && error.code === "HANDLE_TAKEN"
                ? "Just taken · try another"
                : "Couldn’t save · try again",
          );
        },
      },
    );
  };

  return (
    <SetupScreen
      step="handle"
      title="Enter your username"
      body=""
      onSkip={save.isPending ? undefined : next}
      footer={<Button label="Claim username" disabled={!available} loading={save.isPending} onPress={claim} />}
    >
      <View style={styles.stack}>
        <Text accessibilityRole="header" style={[TYPE.displayBalance, styles.wordmark, { color: color.ink }]}>
          SENRYO
        </Text>
        <SetupField
          variant="username"
          label="Username"
          value={text}
          onChangeText={(t) => {
            touched.current = true;
            setSaveError(undefined);
            setText(t.toLowerCase());
          }}
          placeholder="username"
          {...(message ? { message } : {})}
          {...(check.status === "failed" && !saveError ? { onMessagePress: recheck } : {})}
          {...(known?.state === "held" && !typing
            ? { messageAccessory: <InfoTip title={HELD_INFO.title} body={HELD_INFO.body} /> }
            : {})}
          tone={tone}
          input={{
            autoCapitalize: "none",
            maxLength: HANDLE_MAX,
            returnKeyType: "done",
            onSubmitEditing: claim,
          }}
        />
        <ShowTrades value={visibility} onChange={setVisibility} />
      </View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.xl, paddingBottom: SPACE.lg },
  wordmark: { textAlign: "center", marginBottom: SPACE.sm },
});
