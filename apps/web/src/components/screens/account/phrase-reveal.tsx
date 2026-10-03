"use client";

/**
 * The 24 words after a step-up, decrypting in place (21st Encrypted Text #18575). Hidden again after
 * PHRASE_VISIBLE_MS or as soon as the tab is hidden; the string is dropped from state on hide (JS strings can't be
 * zeroed). Never copied to the clipboard by us — typing it out is the safer habit.
 */
import { EyeOff, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { PHRASE_VISIBLE_MS } from "@/lib/constants/auth";

const WORD_STAGGER_MS = 24;

export function PhraseReveal({ phrase, onHide }: { phrase: string; onHide: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onHide, PHRASE_VISIBLE_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onHide]);

  const words = phrase.split(" ");
  return (
    <div className="grid gap-3">
      <p className="flex items-start gap-2 rounded-sm border border-down/50 bg-down/10 p-2 text-caption text-down">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Anyone with these words controls this account. Write them down offline; never paste them into a website.
      </p>
      <ol
        className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-sm border border-border p-3 sm:grid-cols-3"
        aria-label="Recovery phrase"
      >
        {words.map((word, i) => (
          <li key={i} className="flex items-baseline gap-2 text-row">
            <span className="w-5 shrink-0 text-right text-muted-foreground tnum">{i + 1}</span>
            <EncryptedText text={word} startDelayMs={i * WORD_STAGGER_MS} />
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={onHide}>
        <EyeOff />
        Hide
      </Button>
    </div>
  );
}
