/**
 * Where an inbox row goes on the web (R5.22): the push's `senryo://<path>?chainId=` link (`appLink`) mapped onto the
 * web's own places — a call's or a ride's receipt in its drawer, an event's page, money arriving in the wallet — and
 * anything else under `/app/`. A link for the other network still opens its place; the mode capsule says which.
 */
import { DRAWERS } from "@/lib/shell/drawer-param";

export type InboxTarget = { drawer: string; id?: string } | { href: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const ID = /^\d{1,78}$/;

export function inboxTarget(url: string): InboxTarget {
  const [base = ""] = url.replace(SCHEME, "").split("?", 1);
  const parts = base.split("/").filter(Boolean);
  const [head, a, b] = parts;
  if (head === "calls" && a === "rides" && b && ID.test(b)) return { drawer: DRAWERS.ride, id: b };
  if (head === "calls" && a && ID.test(a)) return { drawer: DRAWERS.call, id: a };
  if (head === "events" && a) return { href: `/app/event/?id=${encodeURIComponent(a)}` };
  if (head === "activity") return { drawer: DRAWERS.wallet };
  return { href: parts.length > 0 ? `/app/${parts.join("/")}/` : "/app/" };
}
