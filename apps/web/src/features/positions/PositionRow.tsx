"use client";
/**
 * One open position, a live object (D-343, Codex direction 15; the phone's `PositionRow`): the market's mark inside a
 * ring draining to its end, "BTC ↑ · 10×" over the time left ticking on the server's seconds and the trade's own
 * recorded PnL path, then its PnL rolling (dollars first, ROI under). The row opens the terminal on this exact position
 * (D-340); "Close $5.04" sits beside it, always visible — a sibling, so Enter on the row never closes; in a narrow
 * column it drops to a second line. Right-click or hold for Position details and View receipt.
 */
import { type BookEntry, closeOffered, closeWord, positionIntent, roiText } from "@senryo/calls";
import { usePositionRow, useTerminalReady } from "@senryo/calls/react";
import { intentQuery } from "@senryo/search";
import { Ellipsis, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { moneyDecimals, Odometer, viewDollars } from "@/components/ui/odometer";
import { tradeHref } from "@/features/markets/MarketList";
import { useLongPress } from "@/features/terminal/useLongPress";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { PositionMenu } from "./PositionMenu";
import { PositionRing } from "./PositionRing";
import { PositionTrace } from "./PositionTrace";

function Figures({ e, hidden }: { e: BookEntry; hidden: boolean }) {
  // Closing: the last figure holds, muted, until the result arrives.
  const held = useRef({ pnl: e.pnl, roi: e.roiBps });
  if (e.state !== "closing") held.current = { pnl: e.pnl, roi: e.roiBps };
  const { pnl, roi } = held.current;
  if (pnl === null || roi === null) return <span className="tnum font-display text-position-pnl text-text-3">—</span>;
  const muted = e.state === "closing";
  const dollars = viewDollars(pnl);
  return (
    <span className="flex shrink-0 flex-col items-end">
      <Odometer
        kind="pnl"
        value={dollars}
        decimals={moneyDecimals(dollars)}
        sensitive
        {...(muted ? { tone: false } : {})}
        className={cn("text-position-pnl", muted && "text-text-3")}
      />
      <span className={cn("tnum text-meta", hidden || muted ? "text-text-3" : pnl >= 0n ? "text-up" : "text-down")}>
        {masked(roiText(roi), hidden)}
      </span>
    </span>
  );
}

export function PositionRow({
  entry: e,
  closing,
  onClose,
  onPick,
}: {
  entry: BookEntry;
  closing: boolean;
  onClose: (e: BookEntry) => void;
  /** After the row opens its trade (a drawer closes itself). */
  onPick?: () => void;
}) {
  const hidden = usePrivacy();
  const { head, clock, samples, now } = usePositionRow(e);
  const [menu, setMenu] = useState(false);
  // A link (search's position, D-340) asked for this one: its Close ringed, focus untouched.
  const ready = useTerminalReady().position === e.key;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ready) row.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ready]);
  // A hold opens the menu and swallows the release's navigation.
  const held = useRef(false);
  const hold = useLongPress(
    () => {
      fire("tick", { cue: "tap" });
      onPick?.();
    },
    () => {
      held.current = true;
      setMenu(true);
    },
  );
  const canClose = closeOffered(e, now) || closing;
  return (
    <div ref={row} className="@container">
      <div className="flex min-h-20 flex-col gap-2 px-3 py-3 @sm:flex-row @sm:items-center @sm:gap-3">
        <Link
          href={`${tradeHref(e.symbol)}${intentQuery(positionIntent(e))}`}
          aria-label={`Open ${e.symbol} position`}
          onPointerDown={hold.onPointerDown}
          onPointerUp={hold.onPointerUp}
          onPointerLeave={hold.onPointerLeave}
          onPointerCancel={hold.onPointerCancel}
          onContextMenu={(ev) => {
            ev.preventDefault();
            fire("tick", { cue: "tap" });
            setMenu(true);
          }}
          onClick={(ev) => {
            if (held.current) {
              ev.preventDefault();
              held.current = false;
            }
            hold.onClick();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PositionRing e={e} nowSec={now} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-semibold text-row">{head}</span>
            <span className="flex items-center gap-2">
              <span className="tnum min-w-0 text-meta text-text-3">{clock.text}</span>
              {hidden ? null : <PositionTrace samples={samples} dim={e.state === "no-price"} />}
            </span>
          </span>
          <Figures e={e} hidden={hidden} />
        </Link>
        {/* The menu's own way in (P2): hold and right-click aren't reachable by keyboard or a screen reader. */}
        <button
          type="button"
          aria-label={`${e.symbol} position actions`}
          aria-haspopup="dialog"
          onClick={() => {
            fire("tick", { cue: "tap" });
            setMenu(true);
          }}
          className="flex size-9 shrink-0 items-center justify-center self-end rounded-lg text-text-3 hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring @sm:self-auto"
        >
          <Ellipsis aria-hidden className="size-4" />
        </button>
        {canClose ? (
          <button
            type="button"
            disabled={e.closeValue === null || closing}
            onClick={() => onClose(e)}
            className={cn(
              "flex h-9 shrink-0 items-center justify-center gap-1.5 self-end rounded-lg bg-accent px-3 font-semibold text-accent-foreground text-button-compact disabled:opacity-40 @sm:self-auto",
              ready && "is-ready",
            )}
          >
            {closing ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            {closeWord(e)}
            {e.closeValue !== null ? <Odometer value={viewDollars(e.closeValue)} sensitive className="tnum" /> : null}
          </button>
        ) : null}
      </div>
      <PositionMenu e={e} open={menu} onOpenChange={setMenu} />
    </div>
  );
}
