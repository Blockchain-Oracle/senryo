"use client";
/**
 * Parlay as a chain (P3, D-326; the phone's Parlay — Codex's "Parlay builds a chain", Mitoshi's board and slip): the
 * four leg sockets stay pinned at the top; under them the lane, one round strip for the whole board, the search and
 * the kind chips, then a card per market taking calls with each side's indicative odds for the lane. A pick's mark
 * flies into its socket. Markets that take no calls now sit in one closed group at the end. The slip is the sticky
 * rail on wide screens and a bar that opens the slip drawer on narrow ones; your parlays settle below, leg by leg.
 * Picking, pricing and placing are `@senryo/calls`, the phone's own.
 */
import {
  boardLanes,
  chanceText,
  MARKET_FILTERS,
  type MarketFilter,
  payoutMultiple,
  roundLine,
  windowFor,
} from "@senryo/calls";
import { useParlayBoard, useParlayFlow, useParlayQuote } from "@senryo/calls/react";
import { type CadenceSec, PARLAY } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { SlideOver } from "@/components/ui/drawer";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";
import { flyMark } from "./fly";
import { LegSockets } from "./LegSockets";
import { ParlayCard } from "./ParlayCard";
import { ParlayList } from "./ParlayList";
import { ParlaySlip, type ParlaySlipProps } from "./ParlaySlip";
import { SlipBar } from "./SlipBar";

const DEFAULT_STAKE = 5_000_000n;
const FALLBACK_SYMBOL = "BTC";
const FALLBACK_LANE = 60 as CadenceSec;

export function ParlayScreen() {
  const account = useAccount();
  const catalog = useCatalog();
  const now = useServerSeconds();
  const markets = "value" in catalog ? catalog.value.markets : [];
  const lanes = boardLanes(markets);
  const [laneChoice, setLane] = useState<CadenceSec | null>(null);
  const lane = laneChoice ?? lanes[0] ?? FALLBACK_LANE;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [slip, setSlip] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const sockets = useRef<(HTMLElement | null)[]>([]);
  const flow = useParlayFlow(account, {
    cue: (c) =>
      c === "filled" ? fire("filled", { cue: "open" }) : c === "fail" ? fire("fail", { cue: "error" }) : fire(c),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to place a parlay",
        description: "Your passkey is your account. Your slip stays as it is.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  const quote = useParlayQuote(flow.picks, stake);
  const board = useParlayBoard(markets, query, filter);
  const terms = "value" in catalog ? catalog.value.terms : undefined;
  const q = quote.quote;
  // Between rounds the legs' closing windows price nothing for the next: the price waits for it.
  const multiple = quote.trading && q && !q.refusal ? payoutMultiple(stake, q.payout) : null;
  const round = windowFor(markets[0]?.symbol ?? FALLBACK_SYMBOL, lane, now);

  const pick = (symbol: string, band: number, mark: HTMLElement | null) => {
    const existing = flow.picks.find((p) => p.symbol === symbol);
    if (!existing && flow.picks.length >= PARLAY.maxLegs) {
      fire("warn", { cue: "error" });
      notify({ title: `${PARLAY.maxLegs} legs is the most`, description: "Drop one to add another.", tone: "warning" });
      return;
    }
    fire("tick", { cue: "tap" });
    flow.pick({ symbol, cadenceSec: (existing?.cadenceSec as CadenceSec | undefined) ?? lane, band });
    const target = sockets.current[flow.picks.length];
    if (!existing && mark && target) flyMark(mark, target);
  };
  const legLane = (symbol: string) =>
    (flow.picks.find((p) => p.symbol === symbol)?.cadenceSec as CadenceSec | undefined) ?? lane;
  const card = (m: { symbol: string; name: string }) => (
    <ParlayCard
      key={m.symbol}
      symbol={m.symbol}
      name={m.name}
      cadenceSec={legLane(m.symbol)}
      minHalfSpreadE6={terms?.minHalfSpreadE6 ?? 0}
      pickedBand={flow.picks.find((p) => p.symbol === m.symbol)?.band}
      onPick={(band, mark) => pick(m.symbol, band, mark)}
    />
  );
  const slipProps: ParlaySlipProps = {
    quote,
    minHalfSpreadE6: terms?.minHalfSpreadE6 ?? 0,
    stake,
    onStake: setStake,
    onPick: flow.pick,
    onRemove: flow.remove,
    onPlace: () => void flow.place(quote, stake),
    pending: flow.pending,
    balance: flow.balance,
    signedIn: account.hint?.address !== undefined,
    limits: { min: terms?.minStake ?? DEFAULT_STAKE, max: terms?.maxStake ?? DEFAULT_STAKE },
  };

  return (
    <div className="flex flex-col gap-8 pb-28 lg:pb-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="sticky top-0 z-20 bg-(--shell-plate) py-3">
            <LegSockets picks={flow.picks} socketRefs={sockets} onOpen={() => setSlip(true)} />
          </div>
          {lanes.length > 1 ? (
            <SegmentedControl
              options={lanes.map((c) => ({ value: String(c), label: laneLabel(c) }))}
              label="Lane for new legs"
              value={String(lane)}
              onValueChange={(v) => setLane(Number(v) as CadenceSec)}
              className="self-start"
            />
          ) : null}
          <p aria-live="polite" className={cn("tnum text-meta", round.trading ? "text-text-3" : "text-warn")}>
            {roundLine(round, now)}
          </p>
          <search className="flex flex-col gap-3">
            <SearchField value={query} onChange={setQuery} />
            <div role="tablist" aria-label="Show markets" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {MARKET_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={f.value === filter}
                  onClick={() => {
                    if (f.value === filter) return;
                    fire("tick", { cue: "tap" });
                    setFilter(f.value);
                  }}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-3.5 font-semibold text-button-compact focus-visible:outline-2 focus-visible:outline-ring",
                    f.value === filter ? "bg-foreground text-background" : "bg-secondary hover:bg-accent",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </search>
          {board.groups.length === 0 && board.closed.length === 0 ? (
            <p className="py-6 text-center text-body text-text-3">
              {query ? "No markets match that search." : "Markets are loading."}
            </p>
          ) : null}
          {board.groups.map((g) => (
            <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
              <h2 className="font-semibold text-section-title text-text-2">{g.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">{g.markets.map(card)}</div>
            </section>
          ))}
          {board.closed.length > 0 ? (
            <section aria-label="Closed markets" className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={showClosed}
                onClick={() => {
                  fire("tick", { cue: "tap" });
                  setShowClosed((s) => !s);
                }}
                className="flex min-h-11 items-center gap-2 text-left font-semibold text-section-title text-text-2"
              >
                <span className="flex-1">Closed markets · {board.closed.length}</span>
                <ChevronRight
                  aria-hidden
                  className={cn("size-4 transition-transform duration-(--motion-fast)", showClosed && "rotate-90")}
                />
              </button>
              {showClosed ? <div className="grid gap-3 sm:grid-cols-2">{board.closed.map(card)}</div> : null}
            </section>
          ) : null}
        </div>
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <ParlaySlip {...slipProps} />
        </aside>
      </div>
      <ParlayList owner={account.hint?.address} />
      <SlipBar
        picks={flow.picks}
        price={multiple && q ? `Pays ${multiple} · ${chanceText(q.chanceE6)}` : null}
        trading={quote.trading}
        onOpen={() => {
          fire("tick", { cue: "tap" });
          setSlip(true);
        }}
      />
      <SlideOver open={slip} onOpenChange={setSlip} title="Your parlay" hideHeading>
        <ParlaySlip {...slipProps} />
      </SlideOver>
    </div>
  );
}
