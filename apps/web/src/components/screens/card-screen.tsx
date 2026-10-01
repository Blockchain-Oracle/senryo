"use client";

import { useEffect, useState } from "react";
import { CardAuths } from "@/components/screens/card-auths";
import { PreviewBadge } from "@/components/shell/preview-badge";
import { SectionLabel } from "@/components/shell/primitives";
import { Button } from "@/components/ui/button";
import { FlippableCreditCard } from "@/components/ui/credit-debit-card";
import { UpstashRatelimit } from "@/components/ui/upstash-ratelimit";
import { USD6_ONE } from "@/lib/constants/money";
import { plotValue, usd } from "@/lib/format";
import { CARD } from "@/lib/sample";

const MS_PER_SEC = 1000;

/** Kinpaku 金箔 card (F30): flip card, Wallet/Freeze, FREE·SPEND meter, authorizations. */
export function CardScreen() {
  const [resetAt, setResetAt] = useState(0);
  useEffect(() => setResetAt(Date.now() + CARD.resetInSec * MS_PER_SEC), []);
  return (
    <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:pt-4">
      <section aria-label="Kinpaku card">
        <PreviewBadge
          className="mx-4 mt-4"
          missing="Sample card, allowance and authorizations. The desk connects your real Kinpaku allowance and holds in a later slice."
        />
        <div className="flex justify-center px-4 pt-5">
          <FlippableCreditCard
            cardholderName={CARD.holder}
            cardNumber={CARD.pan}
            expiryDate={CARD.expiry}
            cvv={CARD.cvv}
            kindLabel={CARD.label.toUpperCase()}
            mark={<img src="/brand/seal.svg" alt="" className="size-9" />}
          />
        </div>
        <p className="mt-2 text-center font-mono text-micro text-muted-foreground tracking-[0.12em]">
          TAP CARD TO FLIP · VIRTUAL · WALLET READY
        </p>
        <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
          <Button className="h-11 text-caption">ADD TO WALLET</Button>
          <Button variant="outline" className="h-11 text-caption">
            FREEZE
          </Button>
        </div>
      </section>
      <section aria-label="Spending">
        <div className="mx-4 mt-3 lg:mt-5">
          <UpstashRatelimit
            size="sm"
            title="SPEND LIMIT · 24H"
            limit={plotValue(CARD.spendLimit6)}
            remaining={plotValue(CARD.spendRemaining6)}
            reset={resetAt}
            okLabel="from FREE·SPEND"
            format={(n) => usd(BigInt(Math.round(n)) * USD6_ONE, 0)}
          />
        </div>
        <SectionLabel>Authorizations</SectionLabel>
        <CardAuths className="mx-4" />
      </section>
    </div>
  );
}
