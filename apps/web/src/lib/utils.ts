import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Every type role from globals.css `@theme` (D2 and Living Lacquer) — registered so `text-meta text-text-2` never
 * collapse into one (unregistered, tailwind-merge reads `text-meta` as a colour and drops it).
 */
const TYPE_ROLES = [
  "micro",
  "label",
  "caption",
  "body",
  "title",
  "num-sm",
  "num-md",
  "num-ticker",
  "num-lg",
  "num-xl",
  "num-hero",
  "display-balance",
  "display-margin",
  "display-price",
  "page-title",
  "sheet-title",
  "section-title",
  "row",
  "meta",
  "button",
  "button-compact",
  "tab",
  "fan",
] as const;

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_ROLES] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
