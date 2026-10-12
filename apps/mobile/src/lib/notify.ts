import type { ReactNode } from "react";
import { toast } from "sonner-native";
import { fire } from "~/feedback/fire";
import { TOAST_LIFETIME_MS, TOAST_PENDING_MS } from "./constants/time";

/**
 * The only way to raise a toast (ported rule): `neutral` for records, `warning` for degraded truth, `loading` for a
 * trade on its way. A trade's run is one toast by id (R5.11, `tradeToast`): "Opening Up…" becomes "Up BTC opened"
 * and a close becomes its result, in place. One toast at a time: the host caps `visibleToasts` at 1, so a new one
 * replaces the one showing.
 */
export type ToastTone = "neutral" | "warning" | "loading";

export interface Notice {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** A leading mark (a result's market, R2.8). */
  icon?: ReactNode;
  /** One toast per id: a second with the same id replaces it in place. */
  id?: string;
  /** One plain verb ("Check status"): the toast waits until it is used or swiped away. */
  action?: { label: string; onClick: () => void };
}

export function notify({ title, description, tone = "neutral", icon, id, action }: Notice): void {
  const options = {
    duration: action ? Number.POSITIVE_INFINITY : tone === "loading" ? TOAST_PENDING_MS : TOAST_LIFETIME_MS,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    ...(id ? { id } : {}),
    ...(action ? { action } : {}),
  };
  if (tone === "warning") {
    fire("warn");
    toast.warning(title, options);
    return;
  }
  if (tone === "loading") toast.loading(title, options);
  else toast(title, options);
}

/** Take a toast down by its id (a trade whose signature was cancelled). */
export function dismissToast(id: string): void {
  toast.dismiss(id);
}
