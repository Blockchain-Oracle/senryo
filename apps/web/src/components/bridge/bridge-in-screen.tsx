"use client";

/**
 * Deposit from another chain (flow book B4; the phone's ChainPanel + BridgeIn): the asset (only the ones this network
 * bridges are open; Practice is Circle's testnet USDC over CCTP, the rest "Mainnet only"), the source chain from the live
 * routes, the exact amount in the source token's units, then the quote — what arrives on Monad at least, fees, time and
 * route — re-quoted while open, "Quote expired · Refresh" past its expiry. The transfer starts on the other chain with
 * no wallet of ours there: "Get deposit address" opens a Relay open-mode address bound to this wallet (any wallet or
 * exchange can send to it; a later deposit of the same route arrives too), kept per route so reopening — after a
 * reload too — shows the same address and its timeline, and recorded as Arriving until the balance rises. Below the
 * route's minimum the quote fails first (its reason named), so no address is shown for it. Practice: Relay doesn't
 * serve the test network → "Deposit address · Mainnet only".
 */
import type { BridgeRouteChain } from "@senryo/api-client";
import { type BridgeAsset, MAINNET_CHAIN_ID, MONAD_BRIDGE_ASSETS } from "@senryo/config";
import { requestDepositAddress, useBridgeQuote, useBridgeRoutes, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import Link from "next/link";
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
import { saveDeposit, useSavedDeposit } from "@/lib/bridge/deposit-addresses";
import { MARK_ROW } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import { money } from "@/lib/format";
import { cleanAmountText, parseAmount } from "@/lib/money/amount";
import { recordArrival } from "@/lib/money/arrivals";
import { tokenAmount } from "@/lib/money/format";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { ChainGrid, etaText, providerMark, providerName } from "./chain-grid";
import { DepositAddress } from "./deposit-address";

const MS_PER_SECOND = 1000;

function Quote({ asset, chain }: { asset: BridgeAsset; chain: BridgeRouteChain }) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const address = useAccount().hint?.address;
  const held = useMoneyAssets(address);
  const remote = chain.remote[0];
  const decimals = remote?.decimals ?? 0;
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [refused, setRefused] = useState<string>();
  const saved = useSavedDeposit(env.chainId, address, chain.chainId, asset, remote?.asset);
  const mainnet = env.chainId === MAINNET_CHAIN_ID;
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
  // The saved address already serves this amount (or none is typed): show it; another amount opens a fresh one.
  const reuse = saved !== undefined && (amount === 0n || BigInt(saved.amount) === amount);
  const issue = async () => {
    if (!address || !remote) return;
    if (reuse) return setOpen(true);
    setIssuing(true);
    setRefused(undefined);
    try {
      const issued = await requestDepositAddress(env, {
        fromChain: chain.chainId,
        asset,
        remote: remote.asset,
        amount,
        recipient: address,
      });
      if (issued.status !== "ok") return setRefused(issued.reason);
      saveDeposit(env.chainId, address, issued);
      const token = MONAD_BRIDGE_ASSETS[env.chainId][asset]?.address;
      if (token) {
        recordArrival({
          kind: "bridge",
          chainId: env.chainId,
          account: address.toLowerCase(),
          asset: token.toLowerCase(),
          symbol: issued.out.symbol,
          baseline: (held.find(token)?.wallet ?? 0n).toString(),
          amount: issued.minReceived.toString(),
          via: chain.name,
        });
      }
      setOpen(true);
    } catch {
      setRefused("Couldn’t open an address · try again");
    } finally {
      setIssuing(false);
    }
  };
  if (open && saved)
    return (
      <div className="grid gap-4">
        <DepositAddress deposit={saved} chainName={chain.name} chainMark={chain.mark} />
        <Button variant="ghost" className="font-sans" onClick={() => setOpen(false)}>
          Back
        </Button>
      </div>
    );
  const label = !mainnet
    ? "Deposit address · Mainnet only"
    : reuse
      ? "Show deposit address"
      : issuing
        ? "Opening an address…"
        : "Get deposit address";
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
              <DetailRow
                label="Route"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <EntityMark id={providerMark(ok.provider)} size={MARK_ROW / 2} decorative />
                    {providerName(ok.provider)}
                  </span>
                }
              />
              {expired ? (
                <button
                  type="button"
                  onClick={() => void client.invalidateQueries({ queryKey: ["bridge", "quote"] })}
                  className="text-meta text-link hover:underline"
                >
                  Quote expired · Refresh
                </button>
              ) : null}
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
      {refused ? (
        <p role="alert" className="text-center text-meta text-down">
          {refused}
        </p>
      ) : null}
      <Button size="xl" disabled={!mainnet || issuing || (!reuse && (!ok || expired))} onClick={() => void issue()}>
        {!mainnet ? <Lock /> : null}
        {label}
      </Button>
      <Link href={ROUTES.receive} className="text-center text-meta text-link hover:underline">
        Receive on Monad ›
      </Link>
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
