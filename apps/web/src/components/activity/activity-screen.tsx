"use client";

/**
 * Activity (flow book B12; the phone's activity screen; 21st hari/transaction-list #2943 for row → detail): All ·
 * Trades · Money · Card; rows with the subject mark, a verb title, the time, and the coloured amount; pending rows say
 * so. A row opens its receipt — the facts, the operation's steps when it composed several, every transaction with its
 * explorer link, Share. The indexer's events merge with this browser's journal, so a send that is still settling is a
 * row too ("Checking · don't send it again"), and with the wallet's own movements (D8: received, sent and swapped
 * anywhere).
 */
import type { ChainId } from "@senryo/config";
import { explorerTxUrl } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { type FeedItem, type FeedStatus, useQueryEnv } from "@senryo/query";
import { ArrowLeftRight, ChartCandlestick, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { MarkCluster } from "@/components/identity/mark-cluster";
import { DetailRow, ListRow, QuietLine } from "@/components/kit/list-row";
import { PageHeader } from "@/components/kit/page-header";
import { AssetMark } from "@/components/money/asset-mark";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/vercel-tabs";
import { useAccount } from "@/lib/account/provider";
import { activityTime } from "@/lib/activity/copy";
import { receiptLines, shareText } from "@/lib/activity/receipt";
import { type FeedFilter, useFeed } from "@/lib/activity/use-feed";
import { MARK_ROW, MARK_SMALL } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const MS_PER_SECOND = 1000;
const TABS = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "money", label: "Money" },
  { id: "card", label: "Card" },
] as const;
const GROUP_ICON = { trades: ChartCandlestick, money: ArrowLeftRight, card: CreditCard } as const;

export const STATUS_WORDS: Record<Exclude<FeedStatus, "done">, string> = {
  pending: "Pending",
  checking: "Checking",
  partial: "Partly done",
  failed: "Didn’t go through",
};

function Lead({ item }: { item: FeedItem }) {
  const [first, second] = item.marks;
  if (first && second)
    return <MarkCluster ids={[first.id ?? "", second.id ?? ""]} size={MARK_SMALL + MARK_SMALL / 2} />;
  if (first) return <AssetMark asset={{ mark: first.id ?? "", symbol: first.label, logoUrl: null }} size={MARK_ROW} />;
  const Glyph = GROUP_ICON[item.group];
  return (
    <span className="grid size-10 place-items-center rounded-full bg-raised-2">
      <Glyph className="size-5 text-text-2" aria-hidden />
    </span>
  );
}

function Receipt({
  item,
  me,
  chainId,
  onClose,
}: {
  item: FeedItem;
  me: string;
  chainId: ChainId;
  onClose: () => void;
}) {
  const record = item.source.kind === "journal" ? item.source.record : undefined;
  const last = item.hashes.at(-1);
  return (
    <div className="grid gap-4 py-2">
      <div className="grid justify-items-center gap-2 text-center">
        <Lead item={item} />
        <h2 className="text-sheet-title">{item.title}</h2>
        {item.status === "done" ? null : (
          <p className={cn("text-meta", item.status === "failed" ? "text-down" : "text-warn")}>
            {item.status === "checking" ? "Checking the chain · don’t send it again" : STATUS_WORDS[item.status]}
          </p>
        )}
      </div>
      <div>
        {receiptLines(item, me).map((l, i) => (
          <DetailRow key={`${l.label}:${i}`} label={l.label} value={l.value} />
        ))}
        {record && record.plannedActions.length > 1 ? (
          <DetailRow
            label="Steps"
            value={
              record.steps.map((s) => `${s.action} · ${s.outcome}`).join(", ") || record.plannedActions.join(" → ")
            }
          />
        ) : null}
      </div>
      {item.hashes.map((hash) => (
        <a
          key={hash}
          href={explorerTxUrl(chainId, hash)}
          target="_blank"
          rel="noreferrer"
          className="text-meta text-link hover:underline"
        >
          Transaction {shortAddress(hash)} ›
        </a>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="xl"
          onClick={() => {
            const text = shareText(item, me, chainId);
            if (navigator.share) void navigator.share({ text }).catch(() => undefined);
            else void navigator.clipboard?.writeText(text);
          }}
        >
          Share
        </Button>
        {last ? (
          <Button asChild variant="secondary" size="xl">
            <a href={explorerTxUrl(chainId, last)} target="_blank" rel="noreferrer">
              Explorer
            </a>
          </Button>
        ) : (
          <Button variant="ghost" size="xl" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

function Rows({ me, filter, onOpen }: { me: `0x${string}`; filter: FeedFilter; onOpen: (i: FeedItem) => void }) {
  const feed = useFeed(me, filter);
  if (!feed.items) return feed.error ? <QuietLine>Couldn’t load activity</QuietLine> : <RowsSkeleton />;
  if (feed.items.length === 0)
    return <QuietLine action={{ label: "Markets", href: ROUTES.markets }}>Nothing yet</QuietLine>;
  return (
    <div>
      {feed.error ? <p className="text-meta text-warn">Offline · showing this browser’s sends</p> : null}
      {feed.items.map((item) => {
        const when = activityTime(Math.floor(item.at / MS_PER_SECOND));
        const live = item.status === "pending" || item.status === "checking";
        return (
          <ListRow
            key={item.id}
            onClick={() => onOpen(item)}
            leading={<Lead item={item} />}
            title={item.title}
            subtitle={item.status === "done" ? when : `${STATUS_WORDS[item.status]} · ${when}`}
            value={
              item.figure ? (
                <span
                  className={item.figure.tone === "up" ? "text-up" : item.figure.tone === "down" ? "text-down" : ""}
                >
                  {item.figure.text}
                </span>
              ) : undefined
            }
            trailing={live ? <Loader2 className="size-4 animate-spin text-text-2" aria-label="Pending" /> : null}
          />
        );
      })}
      {feed.hasMore ? (
        <Button variant="ghost" className="w-full font-sans" disabled={feed.loadingMore} onClick={feed.loadMore}>
          {feed.loadingMore ? "Loading…" : "More"}
        </Button>
      ) : null}
    </div>
  );
}

export function ActivityScreen() {
  const env = useQueryEnv();
  const me = useAccount().hint?.address;
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [open, setOpen] = useState<FeedItem>();
  return (
    <Column className="grid gap-3">
      <PageHeader title={open ? "Receipt" : "Activity"} back={ROUTES.home} />
      {!me ? (
        <QuietLine action={{ label: "Create account", href: ROUTES.welcome }}>Activity lives in your account</QuietLine>
      ) : open ? (
        <Receipt item={open} me={me} chainId={env.chainId} onClose={() => setOpen(undefined)} />
      ) : (
        <>
          <Tabs tabs={TABS} activeTab={filter} label="Activity" onTabChange={(id) => setFilter(id as FeedFilter)} />
          <Rows me={me} filter={filter} onOpen={setOpen} />
        </>
      )}
      {open ? (
        <Button variant="ghost" className="font-sans" onClick={() => setOpen(undefined)}>
          Back to Activity
        </Button>
      ) : null}
    </Column>
  );
}
