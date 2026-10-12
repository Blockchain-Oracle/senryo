/**
 * A trade's one toast on the phone (R5.11): each step of its run (`@senryo/calls` `TradeNote`) by its id — the spinner
 * while it is on its way, then the market's mark — the terminal's flows and the results (`ResultHost`) write to the
 * same toast.
 */
import { maskedNote, type TradeNote } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { EntityMark } from "~/components/identity/EntityMark";
import { balancesHidden, HIDDEN_AMOUNT } from "~/lib/hide-balances";
import { dismissToast, notify } from "~/lib/notify";
import { SIZE } from "~/theme";

export function tradeToast(id: string, raw: TradeNote | null): void {
  if (!raw) {
    dismissToast(id);
    return;
  }
  // Hidden balances keep the words and mask the money (R5.14).
  const note = balancesHidden() ? maskedNote(raw, HIDDEN_AMOUNT) : raw;
  notify({
    title: note.title,
    ...(note.description ? { description: note.description } : {}),
    tone: note.tone === "info" ? "neutral" : note.tone,
    id,
    ...(note.action ? { action: { label: note.action.label, onClick: note.action.run } } : {}),
    ...(note.tone === "loading"
      ? {}
      : { icon: <EntityMark id={marketId(note.symbol)} size={SIZE.markInline} decorative /> }),
  });
}
