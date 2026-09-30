"use client";

// 21st: starc007/be-ui-multi-chain-swap (#16251) — https://21st.dev/@starc007/components/be-ui-multi-chain-swap
// Quote rows, optional destination, primary action. D2: mono tabular values, hairline boxes.
import { Clock3, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SWAP_PANEL_SPRING, USD_DIGITS } from "@/lib/constants/swap";
import { formatAmount, type SwapQuote, type Token } from "./types";

const ROW = "flex items-center justify-between text-caption";
const VALUE = "font-mono font-medium text-foreground tnum";

interface QuoteRowsProps {
  from: Token;
  to: Token;
  rate: number;
  quote: SwapQuote | undefined;
  quoting: boolean;
}

export function QuoteRows({ from, to, rate, quote, quoting }: QuoteRowsProps) {
  return (
    <dl className="mt-2 space-y-2 rounded-xl border border-border bg-background/60 p-3">
      <div className={ROW}>
        <dt className="text-muted-foreground">Rate</dt>
        <dd className={VALUE}>
          1 {from.symbol} = {formatAmount(rate)} {to.symbol}
        </dd>
      </div>
      <div className={ROW}>
        <dt className="text-muted-foreground">Network fee</dt>
        <dd className={VALUE}>{quote ? `$${quote.feeUsd.toFixed(USD_DIGITS)}` : "—"}</dd>
      </div>
      <div className={ROW}>
        <dt className="text-muted-foreground">Slippage</dt>
        <dd className={VALUE}>{quote ? `${quote.slippagePct}%` : "—"}</dd>
      </div>
      <div className={ROW}>
        <dt className="text-muted-foreground">ETA</dt>
        <dd className={`inline-flex items-center gap-1 ${VALUE}`}>
          {quoting ? <Loader2 className="size-3 animate-spin" /> : <Clock3 className="size-3" />}
          {quote?.eta ?? "—"}
        </dd>
      </div>
    </dl>
  );
}

interface DestinationRowProps {
  show: boolean;
  onToggle: () => void;
  address: string;
  onAddress: (value: string) => void;
  reduce: boolean;
}

export function DestinationRow({ show, onToggle, address, onAddress, reduce }: DestinationRowProps) {
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={show}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-3 text-left font-medium text-body text-foreground transition-colors duration-(--motion-fast) ease-desk hover:bg-muted/50"
      >
        <span>Send to another wallet</span>
        <span className="text-caption text-muted-foreground">{show ? "Hide" : "Optional"}</span>
      </button>
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={SWAP_PANEL_SPRING}
            className="overflow-hidden"
          >
            <input
              value={address}
              onChange={(e) => onAddress(e.target.value)}
              placeholder="Destination address"
              aria-label="Destination address"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-muted/30 px-3 font-mono text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ActionButtonProps {
  from: Token;
  to: Token;
  amount: number;
  destAddress: string;
  onSubmit?: (() => void) | undefined;
}

export function SwapAction({ from, to, amount, destAddress, onSubmit }: ActionButtonProps) {
  const insufficient = amount > from.balance;
  const disabled = amount <= 0 || insufficient;
  let label = `Swap to ${to.symbol}`;
  if (amount <= 0) label = "Enter amount";
  else if (insufficient) label = `Insufficient ${from.symbol}`;
  else if (destAddress) label = `Swap and send ${to.symbol}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSubmit}
      className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 font-semibold text-background text-body transition-transform duration-(--motion-fast) ease-desk active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
