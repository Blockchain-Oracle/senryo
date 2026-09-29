"use client";
// Adapted from 21st "Wallet Card 2" by beratberkayg — https://21st.dev/@beratberkayg/components/wallet-card-2
// Structure kept (stacked bucket tiles → total balance → action row → account rows); hard-coded
// pink/purple/gray re-tokenized to theme vars and the buckets fed with the one-balance split.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowLeftRight, Eye, Lock, TrendingUp, CreditCard, RefreshCw } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Bucket = { label: string; value: number; tone: "trade" | "spend" | "locked"; hint?: string };

const toneCls: Record<Bucket["tone"], string> = {
  trade: "bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))] border-[color-mix(in_srgb,var(--primary)_30%,transparent)]",
  spend: "bg-[color-mix(in_srgb,var(--chart-4)_22%,var(--card))] border-[color-mix(in_srgb,var(--chart-4)_35%,transparent)]",
  locked: "bg-muted border-border",
};
const toneIcon: Record<Bucket["tone"], ReactNode> = {
  trade: <TrendingUp className="w-4 h-4" />,
  spend: <CreditCard className="w-4 h-4" />,
  locked: <Lock className="w-4 h-4" />,
};

export function WalletSplit({ total, sub, buckets, className, cta = "Add money" }: { total: number; sub?: ReactNode; buckets: Bucket[]; className?: string; cta?: string }) {
  return (
    <Card className={cn("p-5 bg-card border border-border shadow-sm rounded-[calc(var(--radius)*1.4)]", className)}>
      <div className="space-y-5">
        <div className="space-y-3 py-4 px-2 border border-border rounded-[var(--radius)] bg-background/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center"><div className="w-3 h-3 bg-primary rounded-full" /></div>
              <span className="text-muted-foreground font-medium">Total balance</span>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-4xl font-bold text-foreground tnum font-display"><NumberFlow value={total} locales="en-US" format={{ style: "currency", currency: "USD" }} /></div>
          {sub && <div className="text-sm font-medium">{sub}</div>}
        </div>
        <div className="space-y-2">
          {buckets.map((b) => (
            <div key={b.label} className={cn("p-3.5 border shadow-sm rounded-[var(--radius)] flex items-center justify-between", toneCls[b.tone])}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-foreground/5 rounded-[calc(var(--radius)*0.6)] flex items-center justify-center text-foreground/70">{toneIcon[b.tone]}</div>
                <div>
                  <span className="font-medium text-foreground text-[15px]">{b.label}</span>
                  {b.hint && <p className="text-[11px] text-muted-foreground leading-tight">{b.hint}</p>}
                </div>
              </div>
              <span className="font-semibold text-foreground tnum">${b.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2.5">
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[var(--radius)] h-12 gap-2"><ArrowDown className="w-4 h-4" />{cta}</Button>
          <Button variant="secondary" className="flex-1 rounded-[var(--radius)] h-12 gap-2 border border-border"><ArrowUp className="w-4 h-4" />Withdraw</Button>
          <Button variant="secondary" size="icon" className="w-12 h-12 rounded-[var(--radius)] border border-border"><ArrowLeftRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </Card>
  );
}
