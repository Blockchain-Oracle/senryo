"use client";

// 21st: starc007/be-ui-multi-chain-swap (#16251) — https://21st.dev/@starc007/components/be-ui-multi-chain-swap
// Token picker sheet + token glyph. Re-tokenized for D2 (hairlines, no shadows, chain hues from CSS vars).
import { Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SWAP_DRAWER_EASE, SWAP_DRAWER_REDUCED_S, SWAP_DRAWER_S } from "@/lib/constants/swap";
import { cn } from "@/lib/utils";
import { type Chain, findById, formatAmount, type Token, type TokenSide } from "./types";

export function TokenIcon({ token, chain, className }: { token: Token; chain: Chain | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-body text-white",
        className,
      )}
      style={chain ? { backgroundColor: chain.color } : undefined}
    >
      {token.icon}
    </span>
  );
}

interface TokenPickerProps {
  open: boolean;
  side: TokenSide | null;
  chains: readonly Chain[];
  tokens: readonly Token[];
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void;
  reduce: boolean;
}

export function TokenPicker({ open, side, chains, tokens, selectedId, onPick, onClose, reduce }: TokenPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close token picker"
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-background/70 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-label="Select token"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: reduce ? SWAP_DRAWER_REDUCED_S : SWAP_DRAWER_S, ease: SWAP_DRAWER_EASE }}
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-popover p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-body text-foreground">Select token</p>
                <p className="text-caption text-muted-foreground">
                  {side === "from" ? "Token to pay with" : "Token to receive"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[22.5rem] space-y-1 overflow-auto pr-1">
              {tokens.map((token) => {
                const chain = findById(chains, token.chainId);
                return (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => onPick(token.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors duration-(--motion-fast) ease-desk hover:border-border hover:bg-muted/50"
                  >
                    <TokenIcon token={token} chain={chain} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{token.symbol}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-micro text-muted-foreground">
                          {chain?.shortName ?? token.chainId}
                        </span>
                      </div>
                      <p className="truncate text-caption text-muted-foreground">{token.name}</p>
                    </div>
                    <div className="text-right font-mono tnum">
                      <p className="font-medium text-body text-foreground">{formatAmount(token.balance)}</p>
                      <p className="text-caption text-muted-foreground">${formatAmount(token.balance * token.usd)}</p>
                    </div>
                    {token.id === selectedId && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
