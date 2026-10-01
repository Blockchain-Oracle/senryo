"use client";

import { SectionLabel } from "@/components/shell/primitives";
import { CopyCode } from "@/components/ui/copy-code-button";
import { QRCodeDisplay } from "@/components/ui/qr-code-generator";
import { type Chain, MultiChainSwap, type SwapQuote, type Token } from "@/components/ui/swap";
import { useQr } from "@/hooks/use-qr";
import { BPS_PERCENT_DECIMALS } from "@/lib/constants/money";
import { plotValue } from "@/lib/format";
import { DEPOSIT_ADDRESS, SWAP_CHAINS, SWAP_QUOTE, SWAP_TOKENS } from "@/lib/sample";

const ADDRESS_HEAD = 12;
const ADDRESS_TAIL = -6;
const QR_PX = 240;

const CHAINS: Chain[] = SWAP_CHAINS.map((c) => ({
  id: c.id,
  name: c.name,
  shortName: c.shortName,
  color: `var(${c.colorVar})`,
  entity: c.entity,
}));

const TOKENS: Token[] = SWAP_TOKENS.map((t) => ({
  id: t.id,
  chainId: t.chainId,
  symbol: t.symbol,
  name: t.name,
  balance: plotValue(t.balance6),
  usd: plotValue(t.usd6),
  entity: t.entity,
}));

const QUOTE: SwapQuote = {
  feeUsd: plotValue(SWAP_QUOTE.fee6),
  slippagePct: plotValue(SWAP_QUOTE.slippageBps, BPS_PERCENT_DECIMALS),
  eta: SWAP_QUOTE.eta,
};

/** Fund (F21/F22): bridge + deposit from any chain → AUSD, or send directly to the persistent address. */
export function FundScreen() {
  const qr = useQr(DEPOSIT_ADDRESS, QR_PX);
  return (
    <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
      <section aria-labelledby="fund-swap">
        <SectionLabel>
          <span id="fund-swap">Bridge + deposit · any chain → AUSD</span>
        </SectionLabel>
        <div className="px-3">
          <MultiChainSwap
            chains={CHAINS}
            tokens={TOKENS}
            defaultFromId="base-usdc"
            defaultToId="mon-ausd"
            quote={QUOTE}
            title="Swap"
          />
        </div>
      </section>
      <section aria-labelledby="fund-direct">
        <SectionLabel>
          <span id="fund-direct">Or send directly</span>
        </SectionLabel>
        <div className="px-3">
          <QRCodeDisplay
            data={qr}
            title="Deposit address · Monad"
            description="Any EVM chain via intents. Credited to FREE·TRADE."
            footer={
              <CopyCode
                code={DEPOSIT_ADDRESS}
                display={`${DEPOSIT_ADDRESS.slice(0, ADDRESS_HEAD)}…${DEPOSIT_ADDRESS.slice(ADDRESS_TAIL)}`}
              />
            }
          />
        </div>
      </section>
    </div>
  );
}
