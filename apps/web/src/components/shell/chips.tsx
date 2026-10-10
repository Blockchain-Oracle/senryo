"use client";
/**
 * The top line's and the rail foot's chips (pivot S6.3): the mode capsule (the phone's `ModeCapsule`), the balance
 * with its eye (Slush's balance pill; the phone's hide-balances), and the live health (the one stream, D-272).
 */
import { type HealthTone, marketOf } from "@senryo/calls";
import { usePriceHealth } from "@senryo/calls/react";
import { ids } from "@senryo/identity";
import { useStreamStatus } from "@senryo/live/react";
import { useMarketAccount } from "@senryo/query";
import { Eye, EyeOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { EntityMark } from "@/components/identity/entity-mark";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { tapFeedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const CHAIN_MARK = 16;
const PRACTICE = ACTIVE_NETWORK.key === "testnet";

/** "Practice · Test dollars" (violet) or "Real · USDC" (blue): every money surface says which money it is. */
export function ModeCapsule({ className }: { className?: string | undefined }) {
  const money = PRACTICE ? "Test dollars" : "USDC";
  return (
    <span
      className={cn("mode-capsule", PRACTICE ? "is-practice" : "is-real", className)}
      title={PRACTICE ? "Practice: test dollars on Monad's test network" : "Real: USDC on Monad"}
    >
      <EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={CHAIN_MARK} decorative />
      <span className="mode-word">{ACTIVE_NETWORK.modeLabel}</span>
      <span className="mode-money">· {money}</span>
    </span>
  );
}

/** The balance (opens the wallet drawer) and the eye that hides every amount on this device. */
export function BalanceChip({ className }: { className?: string | undefined }) {
  const address = useAccount().hint?.address;
  const account = useMarketAccount(address);
  const hidden = usePrivacy();
  if (!address) return null;
  const balance = "value" in account ? money(account.value.balance) : "—";
  return (
    <span className={cn("balance-chip", className)}>
      <button
        type="button"
        className="balance-amount tnum"
        aria-label={hidden ? "Balance hidden. Open the wallet" : `Balance ${balance}. Open the wallet`}
        onClick={() => {
          tapFeedback();
          openDrawer(DRAWERS.wallet);
        }}
      >
        {masked(balance, hidden)}
      </button>
      <button
        type="button"
        className="balance-eye"
        aria-pressed={hidden}
        aria-label={hidden ? "Show balances" : "Hide balances"}
        onClick={() => {
          tapFeedback();
          setPrivacy(!hidden);
        }}
      >
        {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </span>
  );
}

const TONE_CLASS: Record<HealthTone, string> = { live: "is-live", late: "is-waiting", off: "is-off" };
const TRADE_PATH = /^\/app\/trade\/([a-z0-9]+)/;

function Chip({
  tone,
  word,
  title,
  className,
}: {
  tone: HealthTone;
  word: string;
  title: string;
  className?: string | undefined;
}) {
  return (
    <span className={cn("health-chip", TONE_CLASS[tone], className)} role="status" title={title}>
      <span className="health-word">{word}</span>
    </span>
  );
}

/** On a terminal: that market's price health — "Live" only when the stream and its price are both live (R1.20). */
function MarketHealthChip({ symbol, className }: { symbol: string; className?: string | undefined }) {
  const h = usePriceHealth(symbol);
  return <Chip tone={h.tone} word={h.word} title={h.notice ?? `${symbol} is live`} className={className} />;
}

/** Elsewhere: the stream's; nothing while the tab is hidden. */
function StreamHealthChip({ className }: { className?: string | undefined }) {
  const status = useStreamStatus();
  if (status === "idle") return null;
  const live = status === "live";
  return (
    <Chip
      tone={live ? "live" : "late"}
      word={live ? "Live" : "Connecting"}
      title={live ? "Prices are streaming" : "Reconnecting to prices"}
      className={className}
    />
  );
}

export function HealthChip({ className }: { className?: string | undefined }) {
  const viewed = TRADE_PATH.exec(usePathname() ?? "")?.[1];
  const symbol = viewed ? marketOf(viewed.toUpperCase())?.symbol : undefined;
  return symbol ? (
    <MarketHealthChip symbol={symbol} className={className} />
  ) : (
    <StreamHealthChip className={className} />
  );
}
