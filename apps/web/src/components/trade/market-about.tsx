"use client";

/**
 * Market detail's About (flow book C2 step 3, the phone's MarketAbout): two or three sentences on what the market is, a
 * stats grid — Max leverage · Fee · Spread now · Funding now · Hours · OI long / short — and a Technical details
 * disclosure. Every value is the market's configuration or what the engine and oracle answered in the price's own read;
 * a value that isn't known is left out, never estimated.
 */
import { addressOf } from "@senryo/chain";
import {
  type ChainId,
  type EngineMarket,
  engineMarket,
  explorerAddressUrl,
  marketPair,
  TESTNET_CHAIN_ID,
} from "@senryo/config";
import { DECIMALS, formatUnits, nextTransition, notional, shortAddress, utcSlotLabel } from "@senryo/core";
import { useCalendar } from "@senryo/query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DetailRow } from "@/components/kit/list-row";
import { known } from "@/components/ui/reading";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { money } from "@/lib/format";
import type { MarketLine } from "@/lib/markets/line";
import { ageLabel, STATUS_LABEL, useNowSec } from "@/lib/markets/session";
import { borrowApr, fundingForMarket, marketRates } from "@/lib/trade/rates";
import { cn } from "@/lib/utils";

const bpsPct = (bps: bigint) => `${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.cents)}%`;

/** What each market is (flow book C2 step 3; C3a for what long and short mean). */
export const MARKET_ABOUT: Record<string, string> = {
  XAU: "Gold, priced in US dollars per troy ounce by Chainlink. Go long if you think gold will rise, short if you think it will fall. Settled in dollars; no metal changes hands.",
  XAG: "Silver, priced in US dollars per troy ounce by Chainlink. Go long if you think silver will rise, short if you think it will fall. Settled in dollars; no metal changes hands.",
  EUR: "The euro against the US dollar (EUR/USD). Long profits when the euro strengthens against the dollar; short profits when it weakens.",
  GBP: "The British pound against the US dollar (GBP/USD). Long profits when the pound strengthens against the dollar; short profits when it weakens.",
  JPY: "The Japanese yen against the US dollar, quoted as dollars per yen (JPY/USD). Long JPY means the yen rises against the dollar; short means it falls.",
  CHF: "The Swiss franc against the US dollar (CHF/USD). Long profits when the franc strengthens against the dollar; short profits when it weakens.",
  CAD: "The Canadian dollar against the US dollar (CAD/USD). Long profits when the Canadian dollar strengthens; short profits when it weakens.",
};

function feedSource(meta: EngineMarket, chainId: ChainId): { label: string; address: string } | undefined {
  if (chainId !== TESTNET_CHAIN_ID) return { label: "Feed contract", address: meta.mainnetFeed };
  try {
    return { label: "Mirror of the feed", address: addressOf(chainId, meta.testnetMirror) };
  } catch {
    return undefined;
  }
}

export function MarketAbout({ line }: { line: MarketLine }) {
  const [open, setOpen] = useState(false);
  const meta = engineMarket(line.marketId);
  const calendar = known(useCalendar(line.market.calendarId));
  const now = useNowSec();
  const { risk, book, pv } = line.market;
  const rates = marketRates(line.market);
  const source = meta ? feedSource(meta, ACTIVE_NETWORK.chainId) : undefined;
  const isOpen = line.status === "OPEN";
  const turn = calendar && now > 0n ? nextTransition(calendar, now, !isOpen) : undefined;
  const hours = turn === undefined ? STATUS_LABEL[line.status] : `${isOpen ? "Closes" : "Opens"} ${utcSlotLabel(turn)}`;
  const stats = [
    { label: "Max leverage", value: line.maxLeverageX > 0 ? `${line.maxLeverageX}×` : "—" },
    { label: "Fee", value: bpsPct(risk.feeBps) },
    { label: "Spread now", value: bpsPct(pv.spreadBps) },
    { label: "Funding now", value: isOpen ? fundingForMarket(rates) : "Paused" },
    { label: "Hours", value: hours },
    {
      label: "OI long / short",
      value: `${money(notional(book.longSize, line.price18), 0)} / ${money(notional(book.shortSize, line.price18), 0)}`,
    },
  ];
  return (
    <section className="grid gap-3" aria-labelledby="about-title">
      <h2 id="about-title" className="text-section-title">
        About {line.name}
      </h2>
      <p className="text-meta text-text-2">{MARKET_ABOUT[line.symbol] ?? `${line.name} perpetual.`}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dd className="truncate text-row tnum">{s.value}</dd>
            <dt className="text-meta text-text-3">{s.label}</dt>
          </div>
        ))}
      </dl>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between py-1 text-meta text-text-2 hover:text-foreground"
      >
        Technical details{" "}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div>
          {meta ? <DetailRow label="Price feed" value={`Chainlink ${meta.feedDescription}`} /> : null}
          {meta ? <DetailRow label="Pair" value={marketPair(meta)} /> : null}
          {source ? (
            <DetailRow
              label={source.label}
              value={
                <a
                  href={explorerAddressUrl(ACTIVE_NETWORK.chainId, source.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link hover:underline"
                >
                  {shortAddress(source.address)}
                </a>
              }
            />
          ) : null}
          <DetailRow label="Oracle updated" value={ageLabel(line.updatedAt, now)} />
          {meta ? <DetailRow label="Price precision" value={`${meta.priceDecimals} decimals`} /> : null}
          <DetailRow label="Initial margin" value={bpsPct(risk.imBps)} />
          <DetailRow label="Maintenance margin" value={bpsPct(risk.mmBps)} />
          <DetailRow label="Profit cap" value={`${bpsPct(risk.maxProfitBps)} of entry`} />
          <DetailRow label="Borrow, both sides" value={borrowApr(rates)} />
          <DetailRow label="Venue" value={`Senryo · ${ACTIVE_NETWORK.name}`} />
        </div>
      ) : null}
    </section>
  );
}
