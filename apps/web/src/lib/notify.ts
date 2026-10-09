"use client";
/**
 * A toast (the phone's `notify`): sonner's, mounted once by the app shell. Warnings carry the warning tone; an action
 * is one plain verb ("Sign in").
 */
import { toast } from "sonner";

export interface Notice {
  title: string;
  description?: string;
  tone?: "info" | "warning";
  action?: { label: string; onClick: () => void };
}

export function notify({ title, description, tone = "info", action }: Notice): void {
  const options = {
    ...(description ? { description } : {}),
    ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
  };
  if (tone === "warning") toast.warning(title, options);
  else toast(title, options);
}
