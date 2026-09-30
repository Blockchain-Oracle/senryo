"use client";

// 21st: starc007/be-ui-multi-chain-swap (#16251) — https://21st.dev/@starc007/components/be-ui-multi-chain-swap
// The pay/receive field and the flip button. D2: mono tabular amounts, hairline boxes, no shadows.
import { ArrowDownUp, ChevronDown, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { SWAP_SPRING } from "@/lib/constants/swap";
import { TokenIcon } from "./token-select";
import { type Chain, formatAmount, parseDecimal, type Token, type TokenSide } from "./types";

interface FieldProps {
  side: TokenSide;
  token: Token;
  chain: Chain | undefined;
  amount: string;
  onAmount?: (value: string) => void;
  quoting: boolean;
  onOpenPicker: () => void;
}

export function SwapField({ side, token, chain, amount, onAmount, quoting, onOpenPicker }: FieldProps) {
  const label = side === "from" ? "You pay" : "You receive";
  const inputId = `swap-${side}-amount`;
  const usdValue = parseDecimal(amount) * token.usd;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between text-caption text-muted-foreground">
        <label htmlFor={inputId} className="font-medium">
          {label}
        </label>
        <span className="font-mono tnum">Balance {formatAmount(token.balance)}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {onAmount ? (
            <input
              id={inputId}
              value={amount}
              onChange={(e) => onAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              className="w-full bg-transparent font-mono font-semibold text-foreground text-num-lg tracking-tight outline-none tnum placeholder:text-muted-foreground"
            />
          ) : (
            <output
              id={inputId}
              className="block h-10 font-mono font-semibold text-foreground text-num-lg tracking-tight tnum"
            >
              {quoting ? <Loader2 className="mt-1 size-7 animate-spin text-muted-foreground" /> : amount || "0"}
            </output>
          )}
          <div className="mt-1 font-mono text-caption text-muted-foreground tnum">≈ ${formatAmount(usdValue)}</div>
        </div>

        <button
          type="button"
          onClick={onOpenPicker}
          aria-label={`Choose token to ${side === "from" ? "pay with" : "receive"}, ${token.symbol} selected`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-2 font-semibold text-body text-foreground transition-transform duration-(--motion-fast) ease-desk active:scale-[0.97]"
        >
          <TokenIcon token={token} chain={chain} />
          <span>{token.symbol}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 text-caption text-muted-foreground">
        <span
          aria-hidden
          className="size-2 rounded-full bg-primary"
          style={chain ? { backgroundColor: chain.color } : undefined}
        />
        {chain?.name ?? token.chainId}
      </div>
    </div>
  );
}

export function FlipButton({ rotation, reduce, onClick }: { rotation: number; reduce: boolean; onClick: () => void }) {
  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <motion.button
        type="button"
        onClick={onClick}
        animate={reduce ? { rotate: 0 } : { rotate: rotation }}
        transition={SWAP_SPRING}
        aria-label="Flip tokens"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-transform active:scale-[0.96]"
      >
        <ArrowDownUp className="size-4" />
      </motion.button>
    </div>
  );
}
