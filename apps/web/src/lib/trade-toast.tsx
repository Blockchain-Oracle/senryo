"use client";
/**
 * A trade's one toast on the web (R5.11): each step of its run (`@senryo/calls` `TradeNote`) by its id — the spinner
 * while it is on its way, then the market's mark — the terminal's flows and the results (`ResultHost`) write to the
 * same toast.
 */
import { maskedNote, type TradeNote } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { dismissToast, notify } from "@/lib/notify";
import { HIDDEN_AMOUNT, privacyOn } from "@/lib/shell/privacy";

const MARK = 20;

export function tradeToast(id: string, raw: TradeNote | null): void {
  if (!raw) {
    dismissToast(id);
    return;
  }
  // Hidden balances keep the words and mask the money (R5.14).
  const note = privacyOn() ? maskedNote(raw, HIDDEN_AMOUNT) : raw;
  notify({
    title: note.title,
    ...(note.description ? { description: note.description } : {}),
    tone: note.tone,
    id,
    ...(note.action
      ? { action: { label: note.action.label, onClick: note.action.run }, persistent: true as const }
      : {}),
    ...(note.tone === "loading" ? {} : { icon: <EntityMark id={marketId(note.symbol)} size={MARK} decorative /> }),
  });
}
