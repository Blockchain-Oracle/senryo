"use client";
import { ApiError, HANDLE_RULE, normalizeHandle } from "@senryo/api-client";
/**
 * Setup · the @username (the phone's handle step, A2): a suggested name from the account's own address, checked as it
 * is typed, every state in the field's own line (Checking… · @kai is available · Taken · Reserved · On hold · 4–20
 * characters · Not allowed · Couldn't check). Claiming saves it with the first-save visibility (Practice listed, Real
 * off). Skip leaves the account without a name.
 */
import { DEFAULT_VISIBILITY, HELD_INFO, handleLine, suggestHandle } from "@senryo/calls";
import { socialKeys, useHandleAvailability, useSaveProfile } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 300;
const HANDLE_MAX = 20;

export function HandleStep({ onDone }: { onDone: () => void }) {
  const address = useAccount().hint?.address;
  const session = useSessionRunner();
  const [text, setText] = useState(() => suggestHandle(address));
  const [settled, setSettled] = useState(text);
  const [saveError, setSaveError] = useState<string>();
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);
  const check = useHandleAvailability(settled);
  const client = useQueryClient();
  const save = useSaveProfile(address, session);
  const typing = settled !== text;
  const known = check.status === "fresh" || check.status === "stale" ? check.value : undefined;
  const available = !typing && known?.state === "available";
  let message = "";
  let tone: "quiet" | "good" | "bad" = "quiet";
  if (saveError) [message, tone] = [saveError, "bad"];
  // Why Claim waits (R2.15): an empty field says what to type.
  else if (text === "") message = HANDLE_RULE;
  else if (typing || check.status === "unknown") message = "Checking…";
  else if (check.status === "failed") [message, tone] = ["Couldn't check · Retry", "bad"];
  else if (known) ({ message, tone } = handleLine(known));

  const claim = () => {
    if (!available || !known || save.isPending) return;
    setSaveError(undefined);
    save.mutate(
      { handle: known.handle, ...DEFAULT_VISIBILITY },
      {
        onSuccess: () => {
          fire("confirm", { cue: "tap" });
          onDone();
        },
        onError: (error) => {
          fire("fail");
          setSaveError(
            error instanceof ApiError && error.code === "HANDLE_HELD"
              ? "On hold · try another"
              : error instanceof ApiError && error.code === "HANDLE_TAKEN"
                ? "Just taken · try another"
                : "Couldn't save · try again",
          );
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        claim();
      }}
    >
      <label className="flex h-14 items-center gap-1 rounded-md bg-secondary px-4 text-row-title focus-within:ring-2 focus-within:ring-ring">
        <span aria-hidden className="text-text-3">
          @
        </span>
        <input
          aria-label="Username"
          value={text}
          maxLength={HANDLE_MAX}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
          onChange={(e) => {
            setSaveError(undefined);
            setText(e.target.value.toLowerCase());
          }}
        />
      </label>
      <p
        role="status"
        title={known?.state === "held" && !typing ? HELD_INFO.body : undefined}
        className={cn("min-h-5 text-meta", tone === "good" ? "text-up" : tone === "bad" ? "text-down" : "text-text-3")}
      >
        {check.status === "failed" && !saveError ? (
          <button
            type="button"
            className="underline"
            onClick={() => void client.invalidateQueries({ queryKey: socialKeys.handle(normalizeHandle(settled)) })}
          >
            {message}
          </button>
        ) : (
          message
        )}
      </p>
      <Button type="submit" size="xl" disabled={!available || save.isPending}>
        {save.isPending ? "Claiming…" : "Claim username"}
      </Button>
      <Button type="button" variant="ghost" disabled={save.isPending} onClick={onDone}>
        Skip for now
      </Button>
    </form>
  );
}
