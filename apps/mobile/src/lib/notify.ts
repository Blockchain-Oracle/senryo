import { toast } from "sonner-native";
import { fire } from "~/feedback/fire";
import { TOAST_LIFETIME_MS } from "./constants/time";

/**
 * The only way to raise a toast (ported rule): two tones — `neutral` for records, `warning` for degraded truth.
 * Never a success toast (success is shown in place) and never an error toast for a signed transaction (the trace owns
 * that). One toast at a time: the host caps `visibleToasts` at 1, so a new one replaces the one showing.
 */
export type ToastTone = "neutral" | "warning";

export interface Notice {
  title: string;
  description?: string;
  tone?: ToastTone;
}

export function notify({ title, description, tone = "neutral" }: Notice): void {
  const options = { duration: TOAST_LIFETIME_MS, ...(description ? { description } : {}) };
  if (tone === "warning") {
    fire("warn");
    toast.warning(title, options);
    return;
  }
  toast(title, options);
}
