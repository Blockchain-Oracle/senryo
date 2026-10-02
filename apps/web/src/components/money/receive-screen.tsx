"use client";

/**
 * Receive on Monad (flow book B3; Solflare S21 grammar, the phone's ReceiveCard): ONE address — the wallet itself —
 * receives every token, so there is no wallet/trading toggle and no deposit inbox. The network pill with the Monad
 * mark, the dotted QR with the Monad badge, the address in grouped mono on two rows, Copy · Share · Explorer circles,
 * one line, and the way to other chains. `?from=exchange` leads with the exchange's network tip. While it is open, a
 * verified token's wallet balance going up is the arrival moment ("Received 20 USDC").
 */
import { explorerAddressUrl } from "@senryo/config";
import { ids } from "@senryo/identity";
import { Check, Copy, ExternalLink, Share } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { MarkCluster } from "@/components/identity/mark-cluster";
import { ActionCircle, ActionCircles } from "@/components/kit/action-circle";
import { DottedQr } from "@/components/kit/dotted-qr";
import { PageHeader } from "@/components/kit/page-header";
import { Column } from "@/components/shell/column";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_QR_BADGE, MARK_SMALL, MODE_MARK_SIZE } from "@/lib/constants/brand";
import { COPIED_MS } from "@/lib/constants/money";
import { ROUTES } from "@/lib/constants/routes";
import type { MoneyAsset } from "@/lib/money/assets";
import { amountOf } from "@/lib/money/format";
import { useMoneyAssets } from "@/lib/money/use-money-assets";

const GROUP = 4;
const HEX_START = 2;
const GROUPS_PER_ROW = 5;

/** "0x1234 5678 9abc def0 1234" / "5678 9abc def0 1234 5678": ten groups of four on two rows. */
export function groupedAddress(address: string): [string, string] {
  const groups = address.slice(HEX_START).match(new RegExp(`.{1,${GROUP}}`, "g")) ?? [];
  return [`0x${groups.slice(0, GROUPS_PER_ROW).join(" ")}`, groups.slice(GROUPS_PER_ROW).join(" ")];
}

/** The network pill (21st haydenbleasel/pill #1600, as on the phone): the chain's mark and its name. */
export function NetworkPill() {
  return (
    <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-raised-2 py-1 pr-3 pl-1 text-meta">
      <EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={MODE_MARK_SIZE} decorative />
      {ACTIVE_NETWORK.name}
    </span>
  );
}

/** The first verified wallet balance increase while the page is open. */
function useArrival(assets: readonly MoneyAsset[], ready: boolean): string | undefined {
  const baseline = useRef<Map<string, bigint> | undefined>(undefined);
  const [moment, setMoment] = useState<string>();
  useEffect(() => {
    if (!ready) return;
    if (!baseline.current) {
      baseline.current = new Map(assets.map((a) => [a.key, a.wallet]));
      return;
    }
    for (const a of assets) {
      const before = baseline.current.get(a.key) ?? 0n;
      if (a.wallet > before) {
        baseline.current.set(a.key, a.wallet);
        setMoment(`Received ${amountOf(a, a.wallet - before)}`);
        return;
      }
    }
  }, [assets, ready]);
  return moment;
}

function ReceiveCard({ address, exchange }: { address: `0x${string}`; exchange: boolean }) {
  const money = useMoneyAssets(address);
  const moment = useArrival(money.assets, money.status === "ready");
  const [copied, setCopied] = useState(false);
  const [top, bottom] = groupedAddress(address);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = () => void navigator.clipboard?.writeText(address).then(() => setCopied(true));
  const share = () => {
    if (navigator.share) void navigator.share({ text: address }).catch(() => undefined);
    else copy();
  };
  return (
    <div className="grid gap-5">
      {exchange ? (
        <div className="flex items-center gap-3 rounded-md bg-raised-2 px-4 py-3">
          <MarkCluster ids={[ids.exchange("coinbase"), ids.exchange("binance")]} size={MARK_SMALL} />
          <div>
            <p className="text-row">Choose Monad network</p>
            <p className="text-meta text-text-3">Coinbase sends USDC on Monad</p>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-60">
        <DottedQr
          value={address}
          label={`Your ${ACTIVE_NETWORK.name} address ${address}`}
          center={
            <span className="rounded-full bg-qr-paper p-1">
              <EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={MARK_QR_BADGE} decorative />
            </span>
          }
        />
      </div>
      <p className="text-center font-mono text-row text-text-2 tnum">
        <span className="sr-only">{address}</span>
        <span aria-hidden>
          {top}
          <br />
          {bottom}
        </span>
      </p>
      <ActionCircles>
        <ActionCircle icon={copied ? <Check /> : <Copy />} label={copied ? "Copied" : "Copy"} onClick={copy} />
        <ActionCircle icon={<Share />} label="Share" onClick={share} />
        <ActionCircle
          icon={<ExternalLink />}
          label="Explorer"
          href={explorerAddressUrl(ACTIVE_NETWORK.chainId, address)}
          external
        />
      </ActionCircles>
      {moment ? (
        <p role="status" className="text-center text-row text-up">
          {moment}
        </p>
      ) : (
        <p className="text-center text-meta text-text-2">Any token on Monad</p>
      )}
      <Link href={ROUTES.addMoney} className="text-center text-meta text-link hover:underline">
        Sending from another chain? ›
      </Link>
    </div>
  );
}

export function ReceiveScreen() {
  const address = useAccount().hint?.address;
  const exchange = useSearchParams().get("from") === "exchange";
  return (
    <Column>
      <PageHeader title="Receive" back={ROUTES.home} />
      <div className="grid gap-5 pt-2">
        <NetworkPill />
        {address ? (
          <ReceiveCard address={address} exchange={exchange} />
        ) : (
          <div className="grid gap-3 py-8 text-center">
            <p className="text-row">Sign in to see your address</p>
            <Button asChild size="xl">
              <Link href={ROUTES.welcome}>Create account</Link>
            </Button>
          </div>
        )}
      </div>
    </Column>
  );
}
