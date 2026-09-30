import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The D2 type roles from globals.css `@theme` — registered so `text-label text-primary` never collapse into one. */
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
] as const;

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_ROLES] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
