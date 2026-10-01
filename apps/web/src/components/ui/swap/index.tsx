"use client";

// 21st: starc007/be-ui-multi-chain-swap (#16251) — https://21st.dev/@starc007/components/be-ui-multi-chain-swap
// D2 Fund: bridge + deposit any chain → AUSD. Split on install (>400 lines): panel · token-select · quote-rows · types.
// Data comes in via props (no demo data inside); networks show their real marks (`Chain.entity`), never a colour dot.
import { Settings } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { SWAP_FLIP_DEG, SWAP_QUOTE_DEBOUNCE_MS } from "@/lib/constants/swap";
import { cn } from "@/lib/utils";
import { FlipButton, SwapField } from "./panel";
import { DestinationRow, QuoteRows, SwapAction } from "./quote-rows";
import { TokenPicker } from "./token-select";
import { type Chain, findById, formatAmount, parseDecimal, type SwapQuote, type Token, type TokenSide } from "./types";

export type { Chain, SwapQuote, Token, TokenSide } from "./types";

export interface MultiChainSwapProps {
  chains: readonly Chain[];
  tokens: readonly Token[];
  defaultFromId: string;
  defaultToId: string;
  quote?: SwapQuote;
  title?: string;
  defaultAmount?: string;
  onSubmit?: () => void;
  className?: string;
}

export function MultiChainSwap({
  chains,
  tokens,
  defaultFromId,
  defaultToId,
  quote,
  title = "Swap",
  defaultAmount = "1",
  onSubmit,
  className,
}: MultiChainSwapProps) {
  const reduce = useReducedMotion() ?? false;
  const [fromId, setFromId] = useState(defaultFromId);
  const [toId, setToId] = useState(defaultToId);
  const [amount, setAmount] = useState(defaultAmount);
  const [flipRot, setFlipRot] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [picking, setPicking] = useState<TokenSide | null>(null);
  const [showDest, setShowDest] = useState(false);
  const [destAddress, setDestAddress] = useState("");

  const from = findById(tokens, fromId);
  const to = findById(tokens, toId);
  const numericAmount = parseDecimal(amount);

  useEffect(() => {
    if (numericAmount === 0 || fromId === toId) return;
    setQuoting(true);
    const id = setTimeout(() => setQuoting(false), SWAP_QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [numericAmount, fromId, toId]);

  if (!from || !to) return null;

  const rate = from.usd && to.usd ? from.usd / to.usd : 1;
  const toAmount = numericAmount * rate;

  const flip = () => {
    setFlipRot((r) => r + SWAP_FLIP_DEG);
    setFromId(toId);
    setToId(fromId);
  };

  const pickToken = (id: string) => {
    if (picking === "from") {
      if (id === toId) setToId(fromId);
      setFromId(id);
    } else if (picking === "to") {
      if (id === fromId) setFromId(toId);
      setToId(id);
    }
    setPicking(null);
  };

  return (
    <section
      aria-label={title}
      className={cn("relative isolate w-full overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      <div className="flex h-12 items-center justify-between border-border border-b px-3">
        <h3 className="px-2 font-semibold text-body text-foreground tracking-tight">{title}</h3>
        <button
          type="button"
          aria-label="Swap settings"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <SwapField
          side="from"
          token={from}
          chain={findById(chains, from.chainId)}
          amount={amount}
          onAmount={setAmount}
          quoting={false}
          onOpenPicker={() => setPicking("from")}
        />
        <FlipButton rotation={flipRot} reduce={reduce} onClick={flip} />
        <SwapField
          side="to"
          token={to}
          chain={findById(chains, to.chainId)}
          amount={toAmount > 0 ? formatAmount(toAmount) : ""}
          quoting={quoting}
          onOpenPicker={() => setPicking("to")}
        />
        <QuoteRows from={from} to={to} rate={rate} quote={quote} quoting={quoting} />
        <DestinationRow
          show={showDest}
          onToggle={() => {
            if (showDest) setDestAddress("");
            setShowDest((v) => !v);
          }}
          address={destAddress}
          onAddress={setDestAddress}
          reduce={reduce}
        />
        <SwapAction from={from} to={to} amount={numericAmount} destAddress={destAddress} onSubmit={onSubmit} />
      </div>

      <TokenPicker
        open={picking !== null}
        side={picking}
        chains={chains}
        tokens={tokens}
        selectedId={picking === "from" ? fromId : toId}
        onPick={pickToken}
        onClose={() => setPicking(null)}
        reduce={reduce}
      />
    </section>
  );
}

export default MultiChainSwap;
