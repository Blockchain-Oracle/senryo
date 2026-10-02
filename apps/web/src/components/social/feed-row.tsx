"use client";

/**
 * One feed event (flow book F4; Fomo F15, the phone's FeedRow): a 40 px avatar; name · verb plate · age; the position
 * line (mark, ticker, side, size, the coloured result on a close) or a thesis's market; the thesis text; and Trade this
 * on a trade whose position is still open (C11: the ticket on the same side; the amount stays yours). Bare on the page.
 * The avatar and name open the trader; the market line opens the market.
 */
import type { FeedItem } from "@senryo/api-client";
import { engineMarketsOn } from "@senryo/config";
import { useQueryEnv } from "@senryo/query";
import Link from "next/link";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { MARK_ROW, MODE_MARK_SIZE } from "@/lib/constants/brand";
import { ROUTES, watchHref } from "@/lib/constants/routes";
import { moneyOn, signedMoneyOn } from "@/lib/format";
import { marketOfId, nameOf, TRADE_VERB, timeAgo, tradeIsOpen } from "@/lib/social/format";
import { cn } from "@/lib/utils";

function VerbPlate({ item }: { item: FeedItem }) {
  const loss = item.trade?.fillKind === "LIQUIDATE";
  const label = item.trade ? TRADE_VERB[item.trade.fillKind] : "Thesis";
  return (
    <span
      className={cn(
        "shrink-0 rounded-xs px-2 py-0.5 text-label",
        !item.trade
          ? "bg-accent text-accent-foreground"
          : loss
            ? "bg-down-surface text-down"
            : "bg-raised-2 text-text-2",
      )}
    >
      {label}
    </span>
  );
}

export function FeedRow({ item }: { item: FeedItem }) {
  const env = useQueryEnv();
  const { actor, post, trade } = item;
  const market = marketOfId(env.chainId, item.marketId, trade?.symbol);
  const tradable = market?.engineId !== undefined && engineMarketsOn(env.chainId).some((m) => m.id === market.engineId);
  const profile = watchHref(actor.address, env.chainId);
  const closed = trade && trade.positionNetPnl !== null;
  return (
    <article className="flex gap-3 py-3">
      <Link href={profile} aria-label={`${nameOf(actor)}, profile`} className="shrink-0">
        <Avatar avatar={actor.avatar} address={actor.address} size={MARK_ROW} />
      </Link>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={profile} className="truncate text-row hover:underline">
            {nameOf(actor)}
          </Link>
          <VerbPlate item={item} />
          <span className="ml-auto shrink-0 text-meta text-text-3">{timeAgo(item.at)}</span>
        </div>
        {market ? (
          <Link
            href={tradable ? ROUTES.trade(market.symbol) : "#"}
            aria-disabled={!tradable}
            className="flex items-center gap-1.5 text-meta text-text-2"
          >
            {market.mark ? <EntityMark id={market.mark} size={MODE_MARK_SIZE} decorative /> : null}
            <span className="text-foreground">{market.symbol}</span>
            {trade ? (
              <>
                <span className={trade.side === "LONG" ? "text-up" : "text-down"}>
                  {trade.side === "LONG" ? "Long" : "Short"}
                </span>
                <span className="tnum">{moneyOn(env.chainId, trade.notional, 0)}</span>
                {closed && trade.positionNetPnl !== null ? (
                  <span className={cn("tnum", trade.positionNetPnl < 0n ? "text-down" : "text-up")}>
                    {signedMoneyOn(env.chainId, trade.positionNetPnl)}
                  </span>
                ) : null}
              </>
            ) : null}
          </Link>
        ) : null}
        {post ? <p className="text-row break-words">{post.text}</p> : null}
        {trade && market && tradable && tradeIsOpen(trade) ? (
          <Link
            href={`${ROUTES.trade(market.symbol)}?side=${trade.side === "LONG" ? "long" : "short"}`}
            className="justify-self-start rounded-full bg-raised-2 px-3 py-1 text-meta hover:bg-row-pressed"
          >
            Trade this
          </Link>
        ) : null}
      </div>
    </article>
  );
}
