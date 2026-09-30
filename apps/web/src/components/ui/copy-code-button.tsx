"use client";

// 21st: minhxthanh/copy-code-button (#9552) — https://21st.dev/@minhxthanh/components/copy-code-button
// D2: mono address on the muted well, hairline Copy button, token easing; progress bar via a timed CSS transition
// (the original ticked a 16 ms interval). Reduced motion is honoured globally in globals.css.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const CONFIRM_MS = 4000;
const BLUR_SWAP_MS = 400;

type CopyCodeProps = {
  code: string;
  /** Shortened text to show (e.g. `0x7a3F…8e42`); `code` is what gets copied. */
  display?: string;
  /** Confirmation text after copying. */
  copiedLabel?: string;
  className?: string;
};

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback when the Clipboard API is blocked (insecure origin, permissions).
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "fixed -left-full -top-full";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export function CopyCode({ code, display, copiedLabel = "Address copied", className }: CopyCodeProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const show = setTimeout(() => setShowConfirmation(true), BLUR_SWAP_MS);
    const hide = setTimeout(() => setShowConfirmation(false), CONFIRM_MS);
    const reset = setTimeout(() => setCopied(false), CONFIRM_MS + BLUR_SWAP_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      clearTimeout(reset);
    };
  }, [copied]);

  const handleCopy = async () => {
    await writeClipboard(code);
    setCopied(true);
  };

  return (
    <div className={cn("flex w-full items-center justify-center", className)}>
      <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-muted px-6 py-3">
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 bg-foreground/10 ease-linear",
            copied ? "w-full opacity-100" : "w-0 opacity-0 transition-none",
          )}
          style={copied ? { transitionProperty: "width", transitionDuration: `${CONFIRM_MS}ms` } : undefined}
        />

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-between gap-2 pr-2 pl-4 transition-all duration-500 ease-desk",
            copied ? "pointer-events-none z-0 scale-[0.92] opacity-0 blur-md" : "z-20 scale-100 opacity-100 blur-none",
          )}
        >
          <span className="min-w-0 select-all truncate font-medium font-mono text-muted-foreground text-num-sm tracking-wide tnum">
            {display ?? code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${code}`}
            className="shrink-0 cursor-pointer select-none rounded-lg border border-border bg-card px-5 py-2.5 font-medium text-body text-foreground transition-transform duration-(--motion-fast) ease-desk active:scale-95"
          >
            Copy
          </button>
        </div>

        <div
          aria-live="polite"
          className={cn(
            "pointer-events-none relative z-10 flex items-center gap-3 transition-all duration-700 ease-desk",
            showConfirmation ? "scale-100 opacity-100 blur-none" : "scale-[1.08] opacity-0 blur-md",
          )}
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-primary">
            <svg
              aria-hidden
              className="size-4 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
                strokeDasharray={24}
                strokeDashoffset={showConfirmation ? 0 : 24}
                className="transition-[stroke-dashoffset] delay-300 duration-500 ease-desk"
              />
            </svg>
          </div>
          <span className="font-semibold text-body text-foreground">{showConfirmation ? copiedLabel : ""}</span>
        </div>
      </div>
    </div>
  );
}

export default CopyCode;
