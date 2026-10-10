"use client";
/**
 * A signed-out place's way in (R2.15): what an account unlocks here, in one line, and Sign in (the account drawer:
 * create, sign in or recover). Every drawer and screen that needs an account shows one instead of a bare sentence.
 */
import { Button } from "@/components/ui/button";
import { fire } from "@/lib/feedback";
import { DRAWERS, dropDrawerParam, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";

export function SignInPrompt({ line, compact, className }: { line: string; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3", compact && "flex-row items-center gap-3", className)}>
      <p className="text-body text-text-2">{line}</p>
      <Button
        size={compact ? "sm" : "xl"}
        className={compact ? undefined : "w-full"}
        onClick={() => {
          fire("tick", { cue: "tap" });
          // From inside a drawer, the account drawer replaces it (Back doesn't reopen a drawer that can't be used).
          dropDrawerParam();
          openDrawer(DRAWERS.account);
        }}
      >
        Sign in
      </Button>
    </div>
  );
}
