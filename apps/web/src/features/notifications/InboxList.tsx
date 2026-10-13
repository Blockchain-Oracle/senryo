"use client";
/**
 * The inbox list (R5.22; the phone's `InboxList`, grouping from 21st.dev uvain/notification-panel #27135): rows grouped
 * Today / Earlier, each the subject's real mark, a one-line title and the time quiet beside it; a row unread when the
 * inbox opened sits on a raised fill (no dots).
 */
import type { AppNotification } from "@senryo/api-client";
import { clockTime, dayLabel } from "@/lib/format";
import { useNetwork } from "@/lib/network";
import { cn } from "@/lib/utils";
import { SubjectMark } from "./SubjectMark";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The inbox lists one network, so the push title's "Practice · " prefix is noise here. */
function rowTitle(title: string, modeLabel: string): string {
  const prefix = `${modeLabel} · `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

export function InboxList({
  items,
  unread,
  onOpen,
}: {
  items: readonly AppNotification[];
  unread: ReadonlySet<string>;
  onOpen: (n: AppNotification) => void;
}) {
  const network = useNetwork();
  const today = startOfToday();
  const groups = [
    { title: "Today", rows: items.filter((n) => Date.parse(n.createdAt) >= today) },
    { title: "Earlier", rows: items.filter((n) => Date.parse(n.createdAt) < today) },
  ].filter((g) => g.rows.length > 0);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-1">
          <h3 className="text-meta text-text-3">{group.title}</h3>
          <ul className="flex flex-col">
            {group.rows.map((n) => {
              const at = Date.parse(n.createdAt);
              const time = at >= today ? clockTime(at) : dayLabel(at);
              const fresh = unread.has(n.id);
              const title = rowTitle(n.title, network.modeLabel);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(n)}
                    aria-label={`${fresh ? "Unread. " : ""}${title}, ${time}`}
                    className={cn(
                      "-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring",
                      fresh && "bg-secondary",
                    )}
                  >
                    <SubjectMark subject={n.subject} chainId={n.chainId} />
                    <span className={cn("min-w-0 flex-1 truncate text-row-title", fresh && "font-semibold")}>
                      {title}
                    </span>
                    <span className="tnum text-meta text-text-3">{time}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
