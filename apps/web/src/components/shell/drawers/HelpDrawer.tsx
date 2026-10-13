"use client";
/**
 * Help (R6, D-341): the questions people ask — the shared `HELP` list the phone's Help screen reads — each opening in
 * place, the one search picked open and in view (`?d=help&id=<key>`), then how to reach Senryo.
 */
import { SUPPORT_EMAIL } from "@senryo/api-client";
import { helpOn } from "@senryo/config";
import { ChevronDown, Mail } from "lucide-react";
import { useEffect, useRef } from "react";
import { SlideOver } from "@/components/ui/drawer";
import { useDrawerArg } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./types";

const ANSWERS = helpOn("web");

export function HelpDrawer({ open, onOpenChange }: DrawerProps) {
  const picked = useDrawerArg("id");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !picked) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-help="${CSS.escape(picked)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open, picked]);
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Help" description="Questions people ask first">
      <div ref={list} className="flex flex-col gap-1 pt-2">
        {ANSWERS.map((h) => (
          <details
            key={h.key}
            data-help={h.key}
            open={h.key === picked || undefined}
            className="group rounded-xl px-3 py-1 open:bg-secondary"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold text-row-title">
              {h.q}
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-text-3 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-3 text-body text-text-2">{h.a}</p>
          </details>
        ))}
      </div>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="mt-6 flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-row-title hover:bg-secondary"
      >
        <Mail aria-hidden className="size-5 text-text-2" />
        <span className="flex flex-col">
          Email Senryo
          <small className="font-normal text-meta text-text-3">{SUPPORT_EMAIL}</small>
        </span>
      </a>
    </SlideOver>
  );
}
