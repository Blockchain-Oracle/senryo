"use client";

/**
 * The deposit address (flow book B4 steps 4–5; Solflare S21 receive grammar; the phone's DepositAddress): "Send 10 USDC
 * on Base" with that chain's mark, the dotted QR with the ORIGIN chain's badge, the address in grouped mono, Copy ·
 * Share circles, what arrives at least, the time and the route, then the timeline polled from Relay by the ADDRESS
 * (open mode: a deposit of another amount gets its own request): Waiting → Bridging → Arrived on Monad, or Refunded /
 * Didn't arrive with Relay's reason. Nothing is signed here. 21st was searched first ("crypto deposit address qr":
 * wallet / QR cards — boxes with gradients, none fit); built from the kit's DottedQr, ActionCircle and the stepper.
 */
import { depositTimeline, useDepositStatus } from "@senryo/query";
import { Check, Copy, Info, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ActionCircle, ActionCircles } from "@/components/kit/action-circle";
import { DottedQr } from "@/components/kit/dotted-qr";
import { DetailRow } from "@/components/kit/list-row";
import { groupedAddress } from "@/components/money/receive-screen";
import { known } from "@/components/ui/reading";
import type { SavedDeposit } from "@/lib/bridge/deposit-addresses";
import { MARK_QR_BADGE, MODE_MARK_SIZE } from "@/lib/constants/brand";
import { COPIED_MS } from "@/lib/constants/money";
import { tokenAmount } from "@/lib/money/format";
import { etaText, providerMark, providerName, TimelineSteps } from "./chain-grid";

const RELAY = "relay";
const GROUP = 4;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** EVM addresses in the Receive grouping; any other chain's address in groups of four on two rows. */
function grouped(address: string): [string, string] {
  if (EVM_ADDRESS.test(address)) return groupedAddress(address);
  const groups = address.match(new RegExp(`.{1,${GROUP}}`, "g")) ?? [];
  const half = Math.ceil(groups.length / 2);
  return [groups.slice(0, half).join(" "), groups.slice(half).join(" ")];
}

export function DepositAddress({
  deposit,
  chainName,
  chainMark,
}: {
  deposit: SavedDeposit;
  chainName: string;
  chainMark: string;
}) {
  const [copied, setCopied] = useState(false);
  const [why, setWhy] = useState(false);
  const status = useDepositStatus({ fromChain: deposit.fromChain, depositAddress: deposit.depositAddress });
  const steps = depositTimeline(deposit, known(status), chainName, status.status === "failed", tokenAmount);
  const [top, bottom] = grouped(deposit.depositAddress);
  const exact = tokenAmount(BigInt(deposit.amount), deposit.decimals, deposit.symbol);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = () => void navigator.clipboard?.writeText(deposit.depositAddress).then(() => setCopied(true));
  const share = () => {
    const text = `${deposit.symbol} on ${chainName}\n${deposit.depositAddress}`;
    if (navigator.share) void navigator.share({ text }).catch(() => undefined);
    else copy();
  };
  return (
    <section className="grid gap-5" aria-label="Deposit address">
      <p className="flex items-center justify-center gap-2 text-row">
        <EntityMark id={chainMark} label={chainName} size={MODE_MARK_SIZE} decorative />
        Send {exact} on {chainName}
      </p>
      <div className="mx-auto w-full max-w-60">
        <DottedQr
          value={deposit.depositAddress}
          label={`Deposit address on ${chainName} ${deposit.depositAddress}`}
          center={
            <span className="rounded-full bg-qr-paper p-1">
              <EntityMark id={chainMark} size={MARK_QR_BADGE} decorative />
            </span>
          }
        />
      </div>
      <p className="text-center font-mono text-row text-text-2 tnum">
        <span className="sr-only">{deposit.depositAddress}</span>
        <span aria-hidden>
          {top}
          <br />
          {bottom}
        </span>
      </p>
      <ActionCircles>
        <ActionCircle icon={copied ? <Check /> : <Copy />} label={copied ? "Copied" : "Copy"} onClick={copy} />
        <ActionCircle icon={<Share />} label="Share" onClick={share} />
      </ActionCircles>
      <div>
        <DetailRow label="Only" value={`${deposit.symbol} on ${chainName}`} tone="warn" />
        <DetailRow
          label="You receive at least"
          value={tokenAmount(BigInt(deposit.minReceived), deposit.outDecimals, deposit.outSymbol)}
        />
        <DetailRow label="Time" value={etaText(deposit.etaSec)} />
        <DetailRow
          label="Route"
          value={
            <span className="inline-flex items-center gap-1.5">
              <EntityMark id={providerMark(RELAY)} label={providerName(RELAY)} size={MODE_MARK_SIZE} decorative />
              {providerName(RELAY)}
            </span>
          }
        />
      </div>
      <TimelineSteps steps={steps} label={`Deposit from ${chainName}`} />
      <button
        type="button"
        aria-expanded={why}
        onClick={() => setWhy(!why)}
        className="mx-auto flex items-center gap-1.5 text-meta text-text-3 hover:text-foreground"
      >
        <Info className="size-4" aria-hidden /> How this address works
      </button>
      {why ? (
        <p className="text-center text-meta text-text-2">
          Send {deposit.symbol} on {chainName} here from any wallet or exchange — it arrives in this Monad wallet
          through Relay. The address keeps working for later deposits of the same token. A deposit Relay can’t fill,
          such as one below the minimum, goes back to the address it came from.
        </p>
      ) : null}
    </section>
  );
}
