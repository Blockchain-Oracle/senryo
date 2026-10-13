"use client";
/**
 * Notifications on the web (R5.22; the phone's Notifications page): the inbox from the push ledger in the right
 * drawer (`?d=inbox`), grouped Today / Earlier with each row's real mark. Opening it marks everything up to the newest
 * row read (the bell clears) while rows that were unread keep their fill for this visit; a row opens its place — a
 * call's or ride's receipt, an event, the wallet. No trader yet, a locked account, loading, empty and failure each
 * say one true thing.
 */
import type { AppNotification } from "@senryo/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { InboxList } from "@/features/notifications/InboxList";
import { inboxTarget } from "@/features/notifications/links";
import { useInbox } from "@/features/notifications/useInbox";
import { tapFeedback } from "@/lib/feedback";
import { openDrawer } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./types";

function Quiet({ line, children }: { line: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <p className="text-body text-text-2">{line}</p>
      {children}
    </div>
  );
}

function Inbox() {
  const inbox = useInbox();
  const router = useRouter();
  const items = "value" in inbox.reading ? inbox.reading.value.items : [];
  /** The rows unread when the inbox opened: they keep their fill for this visit after the server marks them read. */
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const marked = useRef(false);
  const newest = items[0]?.createdAt;
  const mark = inbox.markRead.mutate;
  useEffect(() => {
    if (inbox.access !== "ready" || marked.current || newest === undefined) return;
    marked.current = true;
    setSeen(new Set(items.filter((n) => n.readAt === null).map((n) => n.id)));
    if (items.some((n) => n.readAt === null)) mark({ before: newest });
  }, [newest, items, mark, inbox.access]);

  if (inbox.access === "loading") return null;
  if (inbox.access === "none")
    return (
      <Quiet line="Your results arrive here after your first trade.">
        <Button asChild size="xl">
          <Link href="/app/trade/btc/">Open the terminal</Link>
        </Button>
      </Quiet>
    );
  if (inbox.access === "locked")
    return (
      <Quiet line="Unlock to see notifications.">
        <Button size="xl" onClick={() => void inbox.unlock?.().catch(() => undefined)}>
          Unlock
        </Button>
      </Quiet>
    );
  if (inbox.reading.status === "failed")
    return (
      <Quiet line="Notifications didn't load.">
        <Button variant="secondary" onClick={inbox.retry}>
          Try again
        </Button>
      </Quiet>
    );
  if (!("value" in inbox.reading)) return <Quiet line="Loading notifications…" />;
  if (items.length === 0) return <Quiet line="No notifications yet." />;
  const open = (n: AppNotification) => {
    tapFeedback();
    if (n.readAt === null) mark({ ids: [n.id] });
    if (!n.url) return;
    const target = inboxTarget(n.url);
    if ("href" in target) router.push(target.href);
    else openDrawer(target.drawer, target.id ? { id: target.id } : undefined);
  };
  return (
    <div className="flex flex-col gap-4">
      <InboxList items={items} unread={seen} onOpen={open} />
      {inbox.hasMore ? (
        <Button variant="ghost" onClick={inbox.loadMore} disabled={inbox.loadingMore} className="self-start">
          {inbox.loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export function InboxDrawer({ open, onOpenChange }: DrawerProps) {
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Notifications">
      {open ? <Inbox /> : null}
    </SlideOver>
  );
}
