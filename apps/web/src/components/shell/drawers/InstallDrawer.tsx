"use client";
/**
 * Install the app (R2.17; Owarine's `InstallSheet`, Tradash's words): the browser's own install sheet where it holds
 * one (Chromium), else the steps for this phone — iOS has no install event, so Safari's Share → Add to Home Screen —
 * and "Already installed" when it runs installed.
 */
import { CircleCheck } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import type { DrawerProps } from "./types";

const SEAL = 52;
const IOS = [
  "Tap the Share button in Safari's toolbar.",
  "Choose “Add to Home Screen”.",
  "Tap “Add” — Senryo lands on your home screen.",
];
const OTHER = [
  "Open your browser menu (⋮).",
  "Choose “Install app” or “Add to Home screen”.",
  "Confirm — Senryo opens like an app.",
];

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-semibold text-caption text-primary-foreground">
            {i + 1}
          </span>
          <span className="text-body">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function InstallDrawer({ open, onOpenChange }: DrawerProps) {
  const { state, install, busy } = useInstallPrompt();
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Install app">
      <div className="flex flex-col gap-5 pt-2">
        <div className="flex items-center gap-3">
          <Image src="/brand/seal.svg" width={SEAL} height={SEAL} alt="" />
          <div>
            <p className="font-semibold text-title">Install Senryo</p>
            <p className="text-meta text-text-2">On your home screen: full screen, one tap away.</p>
          </div>
        </div>
        {state === "installed" ? (
          <p className="flex items-center justify-center gap-2 rounded-lg bg-secondary py-4 font-semibold text-body">
            <CircleCheck className="size-5" aria-hidden /> Already installed
          </p>
        ) : state === "prompt" ? (
          <Button
            size="xl"
            disabled={busy}
            onClick={async () => {
              fire("press");
              if ((await install()) === "accepted") {
                notify({ title: "Senryo installed", description: "Open it from your home screen." });
                onOpenChange(false);
              }
            }}
          >
            {busy ? "Opening…" : "Install"}
          </Button>
        ) : (
          // Without a held prompt (Safari, or Chromium before it offers one) the browser's own menu installs.
          <Steps steps={state === "ios" ? IOS : OTHER} />
        )}
      </div>
    </SlideOver>
  );
}
