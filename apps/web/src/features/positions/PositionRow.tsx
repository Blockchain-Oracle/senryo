"use client";
/**
 * One open position (Tradash's position row, Owarine's `PositionRow`, R5.3): the market's mark, "BTC ↗" with its lane
 * or leverage and when it ends, then ROI over PnL rolling with the price (D-303: from the fill's fair price; red the
 * moment PnL < 0). Tapping expands the facts — line or knock-out, entry, now, fees, what it pays — and the one way out:
 * Cash out (a call) or Close (a ride) for the exact amount it returns now, and Share (R5.21: its slip at what it's worth
 * now, in the receipt drawer). A held state says why in words.
 */
import { type BookEntry, closeWord, dollars, leverageText, positionHold, positionSub, unitOf } from "@senryo/calls";
import { useTerminalReady } from "@senryo/calls/react";
import { laneLabel, priceText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { ArrowDownRight, ArrowUpRight, ChevronDown, LoaderCircle, Lock, MoveHorizontal, Share2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { moneyDecimals, Odometer, viewDollars } from "@/components/ui/odometer";
import { tradeHref } from "@/features/markets/MarketList";
import { EASE_OUT } from "@/lib/constants/motion";
import { fire, tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const MARK = 32;
const BPS_PER_PERCENT = 100;
const EXPAND = { duration: 0.2, ease: EASE_OUT };

function Fact({ k, v, tone }: { k: string; v: ReactNode; tone?: "down" }) {
  return (
    <>
      <dt className="text-text-3">{k}</dt>
      <dd className={cn("tnum text-right", tone === "down" && "text-down")}>{v}</dd>
    </>
  );
}

function Facts({ e, hidden }: { e: BookEntry; hidden: boolean }) {
  const unit = unitOf(e.symbol);
  const price = (v: bigint | null | undefined) => (v === null || v === undefined ? "—" : priceText(v, unit));
  const money = (v: bigint | null) => (v === null ? "—" : masked(dollars(v), hidden));
  if (e.kind === "ride" && e.ride) {
    return (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-meta">
        <Fact k="Direction" v={`${e.label} · ${leverageText(e.ride.leverageBps)}`} />
        <Fact k="Entry" v={price(e.entryE8)} />
        <Fact k="Now" v={price(e.markE8)} />
        <Fact k="Knocked out at" v={price(e.ride.koE8)} tone="down" />
        <Fact k="Capped at" v={price(e.ride.capE8)} />
        <Fact k="Margin" v={money(e.cost)} />
        <Fact k="Fees" v={money(e.fees)} />
      </dl>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-meta">
      <Fact k="Call" v={`${e.label} · ${e.call ? laneLabel(e.call.cadenceSec) : ""}`} />
      <Fact k="Line" v={price(e.call?.lineE8)} />
      <Fact k="Entry" v={price(e.entryE8)} />
      <Fact k="Now" v={price(e.markE8)} />
      <Fact k="Staked" v={money(e.cost)} />
      <Fact k="Pays if right" v={money(e.call?.shares ?? null)} />
      <Fact k="Fees" v={money(e.fees)} />
    </dl>
  );
}

function Figures({ e }: { e: BookEntry }) {
  if (e.state === "opening" || e.state === "closing")
    return <LoaderCircle aria-label={positionHold(e) ?? ""} className="size-4 animate-spin text-text-3" />;
  if (e.pnl === null || e.roiBps === null) {
    const Icon = e.state === "locked" ? Lock : MoveHorizontal;
    return <Icon aria-label={positionHold(e) ?? ""} className="size-4 text-text-3" />;
  }
  const pnl = viewDollars(e.pnl);
  return (
    <span className="flex flex-col items-end">
      <Odometer kind="pct" value={e.roiBps / BPS_PER_PERCENT} decimals={1} className="font-semibold text-row-title" />
      <Odometer kind="pnl" value={pnl} decimals={moneyDecimals(pnl)} sensitive className="text-meta" />
    </span>
  );
}

export function PositionRow({
  entry: e,
  closing,
  onClose,
}: {
  entry: BookEntry;
  closing: boolean;
  onClose: (e: BookEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  // A link (search's position, D-340) asked for this one: open, Cash out ringed, focus untouched.
  const ready = useTerminalReady().position === e.key;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready) return;
    setOpen(true);
    row.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ready]);
  const hidden = usePrivacy();
  const reduce = useReducedMotion();
  const hold = positionHold(e);
  const Dir = e.up === false ? ArrowDownRight : ArrowUpRight;
  return (
    <div ref={row} className="rounded-2xl bg-secondary">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setOpen((o) => !o);
        }}
        className="flex w-full items-center gap-3 rounded-2xl p-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1 font-semibold text-row-title">
            {e.symbol}
            {e.up === null ? (
              <MoveHorizontal aria-hidden className="size-4 text-text-2" />
            ) : (
              <Dir aria-hidden className={cn("size-4", e.up ? "text-up" : "text-down")} strokeWidth={2.75} />
            )}
            <span className="sr-only">{e.label}</span>
          </span>
          <span className="truncate text-meta text-text-3">{hold ?? positionSub(e)}</span>
        </span>
        <Figures e={e} />
        <ChevronDown aria-hidden className={cn("size-4 text-text-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={EXPAND}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-3 pb-3">
              <Facts e={e} hidden={hidden} />
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <button
                  type="button"
                  disabled={e.closeValue === null || closing}
                  onClick={() => onClose(e)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-4 font-semibold text-background text-row-title disabled:opacity-40",
                    ready && "is-ready",
                  )}
                >
                  {closing ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                  {closeWord(e)}
                  {e.closeValue !== null ? (
                    <Odometer value={viewDollars(e.closeValue)} sensitive className="tnum" />
                  ) : null}
                </button>
                <Link
                  href={tradeHref(e.symbol)}
                  onClick={tapFeedback}
                  className="flex h-11 items-center rounded-xl bg-background px-4 font-semibold text-row-title"
                >
                  Trade
                </Link>
                <button
                  type="button"
                  aria-label={`Share ${e.symbol} ${e.label}`}
                  disabled={e.pnl === null}
                  onClick={() => {
                    tapFeedback();
                    openDrawer(e.kind === "ride" ? DRAWERS.ride : DRAWERS.call, { id: String(e.id) });
                  }}
                  className="flex size-11 items-center justify-center rounded-xl bg-background disabled:opacity-40"
                >
                  <Share2 aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
