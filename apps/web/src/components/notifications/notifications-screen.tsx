"use client";

/**
 * Notifications (flow book G1; the phone's NotificationsScreen + InboxList; grouping from 21st uvain/notification-panel
 * #27135): rows grouped Today / Earlier, each the subject's real mark, a one-line title and the time; an unread row sits
 * on a raised fill (no dots). Opening the inbox marks everything up to the newest row read (the bell clears); a row
 * opens the page its push opens. The web has no push — the inbox is the channel.
 */
import type { AppNotification, NotificationSubject } from "@senryo/api-client";
import { ids } from "@senryo/identity";
import { useProfile, useQueryEnv } from "@senryo/query";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { ListRow, QuietLine } from "@/components/kit/list-row";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { indexedMarketMark } from "@/lib/activity/market-id";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { clockTime } from "@/lib/format";
import { useInbox, webPathOf } from "@/lib/notifications/inbox";
import { cn } from "@/lib/utils";

const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

function PersonMark({ address }: { address: string }) {
  const profile = known(useProfile(address));
  return <Avatar avatar={profile?.avatar ?? null} address={address} size={MARK_ROW} />;
}

function SubjectMark({ subject }: { subject: NotificationSubject | null }) {
  const env = useQueryEnv();
  switch (subject?.kind) {
    case "market":
      return <EntityMark id={indexedMarketMark(env.chainId, subject.marketId)} size={MARK_ROW} decorative />;
    case "token":
      return (
        <EntityMark
          id={
            subject.address.toLowerCase() === NATIVE_TOKEN
              ? ids.native(env.chainId, "MON")
              : ids.token(env.chainId, subject.address)
          }
          label={subject.symbol}
          size={MARK_ROW}
          decorative
        />
      );
    case "person":
      return <PersonMark address={subject.address} />;
    case "card":
      return (
        <span className="grid size-10 place-items-center rounded-full bg-kinpaku-lacquer text-kinpaku-foil">
          <CreditCard className="size-5" aria-hidden />
        </span>
      );
    default:
      return <EntityMark id={ids.brand("senryo")} size={MARK_ROW} variant="symbol" decorative />;
  }
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The inbox lists one network, so a push title's "Practice · " prefix is noise here. */
const rowTitle = (title: string) => {
  const prefix = `${ACTIVE_NETWORK.modeLabel} · `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
};

function Inbox() {
  const router = useRouter();
  const account = useAccount();
  const inbox = useInbox();
  const page = known(inbox.reading);
  const items = page?.items ?? [];
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const marked = useRef(false);
  const newest = items[0]?.createdAt;
  const mark = inbox.markRead.mutate;
  useEffect(() => {
    if (marked.current || newest === undefined) return;
    marked.current = true;
    setSeen(new Set(items.filter((n) => n.readAt === null).map((n) => n.id)));
    // Opening the inbox clears the bell: everything up to the newest row on screen is read.
    if (items.some((n) => n.readAt === null)) mark({ before: newest });
  }, [newest, items, mark]);

  if (inbox.access === "loading") return <RowsSkeleton />;
  if (inbox.access === "guest")
    return (
      <QuietLine action={{ label: "Create account", href: ROUTES.welcome }}>Notifications need an account</QuietLine>
    );
  if (inbox.access === "locked")
    return (
      <QuietLine action={{ label: "Unlock", onClick: () => void account.unlock().catch(() => undefined) }}>
        Unlock to see notifications
      </QuietLine>
    );
  if (!page)
    return inbox.reading.status === "failed" ? (
      <QuietLine action={{ label: "Retry", onClick: () => inbox.retry() }}>Couldn’t load</QuietLine>
    ) : (
      <RowsSkeleton />
    );
  if (items.length === 0) return <QuietLine>No notifications yet</QuietLine>;
  const today = startOfToday();
  const open = (n: AppNotification) => {
    if (n.readAt === null) mark({ ids: [n.id] });
    router.push(webPathOf(n.url));
  };
  const groups = [
    { title: "Today", rows: items.filter((n) => Date.parse(n.createdAt) >= today) },
    { title: "Earlier", rows: items.filter((n) => Date.parse(n.createdAt) < today) },
  ].filter((g) => g.rows.length > 0);
  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <section key={g.title} className="grid">
          <h2 className="text-meta text-text-2">{g.title}</h2>
          {g.rows.map((n) => {
            const at = Date.parse(n.createdAt);
            const time =
              at >= today
                ? clockTime(at)
                : new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
            return (
              <ListRow
                key={n.id}
                className={cn(seen.has(n.id) && "bg-raised-2")}
                onClick={() => open(n)}
                leading={<SubjectMark subject={n.subject} />}
                title={rowTitle(n.title)}
                subtitle={n.body || undefined}
                detail={time}
                detailClassName="text-text-3"
              />
            );
          })}
        </section>
      ))}
      {inbox.hasMore ? (
        <Button variant="ghost" className="font-sans" disabled={inbox.loadingMore} onClick={inbox.loadMore}>
          {inbox.loadingMore ? "Loading…" : "More"}
        </Button>
      ) : null}
    </div>
  );
}

export function NotificationsScreen() {
  return (
    <Column className="grid gap-3">
      <PageHeader title="Notifications" back={ROUTES.home} />
      <Inbox />
    </Column>
  );
}
