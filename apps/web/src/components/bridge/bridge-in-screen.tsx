"use client";

/**
 * Deposit from another chain (flow book B4; the phone's ChainPanel + BridgeIn): the asset (only the ones this network
 * bridges are open; Practice is Circle's testnet USDC over CCTP, the rest "Mainnet only"), the source chain from the live
 * routes, the exact amount in the source token's units, then the quote — what arrives on Monad at least, fees, time and
 * route — re-quoted while open. The transfer itself is signed on the other chain by the wallet holding the funds there;
 * like the phone, the web has no connected-wallet route yet, so the last step is an honest lock, not a dead button.
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import type { BridgeAsset } from "@senryo/config";
import { useBridgeQuote, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { RowsSkeleton } from "@/components/home/home-tabs";
import { EntityMark } from "@/components/identity/entity-mark";
import { DetailRow, ListRow, QuietLine } from "@/components/kit/list-row";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { bridgeAssetMark, bridgeAssetName, bridgeAssetsOn } from "@/lib/bridge/assets";
import { MARK_ROW } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import { cleanAmountText, parseAmount } from "@/lib/money/amount";
import { tokenAmount } from "@/lib/money/format";
import { ChainGrid, etaText, providerName } from "./chain-grid";

const MS_PER_SECOND = 1000;

function Quote({ asset, chain }: { asset: BridgeAsset; chain: BridgeRouteChain }) {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const remote = chain.remote[0];
  const decimals = remote?.decimals ?? 0;
  const [text, setText] = useState("");
  const amount = parseAmount(text, decimals);
  const quote = useBridgeQuote(
    address && remote && amount > 0n
      ? {
          fromChain: chain.chainId,
          toChain: env.chainId,
          asset,
          amount,
          sender: address,
          recipient: address,
          remote: remote.asset,
        }
      : undefined,
  );
  const q = known(quote);
  const ok = q?.status === "ok" ? q : undefined;
  const expired = ok?.expiresAt != null && ok.expiresAt * MS_PER_SECOND < Date.now();
  const feeUsd6 = ok?.fees.reduce((sum, f) => sum + (f.usd6 ?? 0n), 0n);
  return (
    <div className="grid gap-4">
      <label className="grid justify-items-center gap-1">
        <span className="flex items-center gap-2 text-meta text-text-2">
          <EntityMark id={chain.mark} label={chain.name} size={MARK_ROW / 2} decorative /> From {chain.name}
        </span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label={`Amount of ${remote?.symbol ?? asset}`}
          value={text}
          onChange={(e) => {
            const next = cleanAmountText(e.target.value, decimals);
            if (next !== undefined) setText(next);
          }}
          className="w-full bg-transparent text-center font-display text-display-margin outline-none tnum placeholder:text-text-3"
        />
        <span className="text-meta text-text-3">{remote?.symbol}</span>
      </label>
      {amount > 0n ? (
        <div>
          {ok ? (
            <>
              <DetailRow
                label="You receive at least"
                value={tokenAmount(ok.minReceived, ok.out.decimals, ok.out.symbol)}
              />
              <DetailRow label="Fees" value={feeUsd6 !== undefined && feeUsd6 > 0n ? money(feeUsd6) : "Included"} />
              <DetailRow label="Time" value={etaText(ok.etaSec)} />
              <DetailRow label="Route" value={providerName(ok.provider)} />
              {expired ? <p className="text-meta text-warn">Quote expired · it refreshes</p> : null}
            </>
          ) : q?.status === "unsupported" ? (
            <DetailRow label="Route" value={q.reason} tone="warn" />
          ) : quote.status === "failed" ? (
            <DetailRow label="Quote" value="Unavailable · try again" tone="warn" />
          ) : (
            <DetailRow label="Quote" value="Getting a quote" />
          )}
        </div>
      ) : null}
      <Button size="xl" disabled>
        <Lock />
        Send from your {chain.name} wallet · soon
      </Button>
    </div>
  );
}

export function BridgeInScreen() {
  const env = useQueryEnv();
  const [asset, setAsset] = useState<BridgeAsset>();
  const [chain, setChain] = useState<BridgeRouteChain>();
  const routes = useBridgeRoutes(asset, "in");
  const value = known(routes);
  const back = () => (chain ? setChain(undefined) : setAsset(undefined));
  return (
    <Column className="grid gap-4">
      <PageHeader
        title={chain ? `${asset} from ${chain.name}` : asset ? `${asset} from` : "From another chain"}
        {...(asset
          ? {
              right: (
                <button type="button" onClick={back} className="text-meta text-link">
                  Back
                </button>
              ),
            }
          : {})}
        back={ROUTES.addMoney}
      />
      {!asset ? (
        <div>
          {bridgeAssetsOn(env.chainId).map(({ asset: a, served }) => (
            <ListRow
              key={a}
              leading={<EntityMark id={bridgeAssetMark(a)} label={a} size={MARK_ROW} decorative />}
              title={bridgeAssetName(a)}
              subtitle={served ? a : "Mainnet only"}
              className={served ? undefined : "opacity-50"}
              {...(served ? { onClick: () => setAsset(a) } : {})}
              trailing={served ? null : <Lock className="size-4 text-text-3" aria-label="Mainnet only" />}
            />
          ))}
        </div>
      ) : !chain ? (
        value ? (
          value.chains.length === 0 ? (
            <QuietLine>No route for {asset} on this network</QuietLine>
          ) : (
            <ChainGrid routes={value} selected={undefined} onPick={setChain} />
          )
        ) : routes.status === "failed" ? (
          <QuietLine>Couldn’t load the routes</QuietLine>
        ) : (
          <RowsSkeleton />
        )
      ) : (
        <Quote asset={asset} chain={chain} />
      )}
    </Column>
  );
}
