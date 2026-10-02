"use client";

/**
 * The position's TP / SL (flow book C6, plan §0.9 Position "TP/SL row"): the active levels with their distance from the
 * mark and Cancel, then Add take profit / Add stop loss — a price field checked side-aware (long: liq < SL < mark < TP)
 * with its potential P/L, saved in the session. Each save or cancel shows its own status; nothing is re-sent, and a
 * level being placed blocks a second of its kind until the indexer shows it (or it failed and was acknowledged).
 */
import type { PositionView } from "@senryo/chain";
import { notional } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { DetailRow, ListRow } from "@/components/kit/list-row";
import { failureWords } from "@/components/kit/trace-words";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { price18, priceDecimalsOf, signedMoney, signedPct } from "@/lib/format";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { bpsFromMark, parsePrice, type TriggerKind, triggerProblem, useTpSl } from "@/lib/trade/use-tpsl";
import { cn } from "@/lib/utils";

const LABEL: Record<TriggerKind, string> = { tp: "Take profit", sl: "Stop loss" };

/** The traced status of a save or cancel, in words: running, done, didn't go through, or not confirmed yet. */
function TraceLine({ trace, done }: { trace: ReturnType<typeof useTpSl>["tp"]; done: string }) {
  const outcome = useSettledOutcome(trace.events);
  if (trace.events.length === 0) return null;
  const failed = trace.events.find((e) => e.stage === "failed")?.error;
  const text =
    outcome === "finalized"
      ? done
      : outcome === "unknown"
        ? "Not confirmed yet · don’t repeat it"
        : outcome === undefined
          ? "Working…"
          : outcome === "not-sent"
            ? failureWords(failed, "order")
            : "Didn’t go through";
  const tone = outcome === "finalized" ? "text-up" : outcome === undefined ? "text-text-2" : "text-warn";
  return (
    <p aria-live="polite" className={cn("text-meta", tone)}>
      {text}
      {outcome !== undefined && outcome !== "unknown" ? (
        <button type="button" onClick={trace.reset} className="ml-2 text-link hover:underline">
          OK
        </button>
      ) : null}
    </p>
  );
}

function AddLevel({
  kind,
  market,
  position,
  liq18,
  onSave,
  busy,
}: {
  kind: TriggerKind;
  market: LiveMarket;
  position: PositionView;
  liq18: bigint | null | undefined;
  onSave: (price18: bigint) => void;
  busy: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const decimals = priceDecimalsOf(market.marketId);
  const mark = market.pv.price18;
  const price = parsePrice(text);
  const problem = price ? triggerProblem(kind, position.isLong, price, mark, liq18) : undefined;
  const move = price ? notional(position.size, price) - notional(position.size, mark) : undefined;
  const pnl = move === undefined ? undefined : position.isLong ? move : -move;
  return (
    <form
      className="grid gap-2 rounded-md bg-raised-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (price && !problem) onSave(price);
      }}
    >
      <label htmlFor={id} className="text-meta text-text-2">
        {LABEL[kind]} · mark ${price18(mark, decimals)}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={price18(mark, decimals)}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={problem !== undefined}
        />
        <Button type="submit" disabled={!price || problem !== undefined || busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
      {problem ? (
        <p className="text-meta text-down">{problem}</p>
      ) : price && pnl !== undefined ? (
        <p className="text-meta text-text-2">
          {signedPct(bpsFromMark(mark, price))} from mark ·{" "}
          <span className={pnl < 0n ? "text-down" : "text-up"}>{signedMoney(pnl)}</span> at the level
        </p>
      ) : null}
    </form>
  );
}

export function TpSl({
  market,
  position,
  liq18,
}: {
  market: LiveMarket;
  position: PositionView;
  liq18: bigint | null | undefined;
}) {
  const t = useTpSl(market, position);
  const [adding, setAdding] = useState<TriggerKind>();
  const decimals = priceDecimalsOf(market.marketId);
  const busy = t.tp.running || t.sl.running || t.removal.running;
  const kinds: TriggerKind[] = ["sl", "tp"];
  return (
    <section aria-labelledby="tpsl" className="grid gap-2">
      <h2 id="tpsl" className="text-section-title">
        TP / SL
      </h2>
      {t.active.map((level) => (
        <ListRow
          key={level.id}
          title={`${level.takeProfit ? "Take profit" : "Stop loss"} $${price18(level.triggerPrice, decimals)}`}
          subtitle={`${signedPct(bpsFromMark(market.pv.price18, level.triggerPrice))} from mark`}
          trailing={
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void t.cancel(level.id)}>
              Cancel
            </Button>
          }
        />
      ))}
      {t.removal.events.length > 0 ? <TraceLine trace={t.removal} done="Cancelled" /> : null}
      {kinds.map((kind) =>
        t.active.some((l) => l.takeProfit === (kind === "tp")) ? null : t[kind].events.length > 0 ? (
          // A level being placed (or placed and not indexed yet) blocks a second one of its kind.
          <TraceLine key={kind} trace={t[kind]} done={`${LABEL[kind]} set`} />
        ) : adding === kind ? (
          <AddLevel
            key={kind}
            kind={kind}
            market={market}
            position={position}
            liq18={liq18}
            busy={busy}
            onSave={(price) => void t.place(kind, price).then(() => setAdding(undefined))}
          />
        ) : (
          <DetailRow
            key={kind}
            label={LABEL[kind]}
            value={
              <button
                type="button"
                disabled={busy}
                onClick={() => setAdding(kind)}
                className="text-link hover:underline disabled:opacity-40"
              >
                Add
              </button>
            }
          />
        ),
      )}
    </section>
  );
}
