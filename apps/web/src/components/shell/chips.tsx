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
import { useAppTrader } from "@/lib/account/guest";
import { fire, tapFeedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { setActiveNetwork, useNetwork } from "@/lib/network";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const CHAIN_MARK = 16;

/**
 * "Practice · Test dollars" or "Real · USDC" (the rail's compact mode): every money surface says which money it is, and
 * a tap switches to the other (D-320; the top line carries the full `ModeSwitch`).
 */
export function ModeCapsule({ className }: { className?: string | undefined }) {
  const network = useNetwork();
  const practice = network.key === "testnet";
  const money = practice ? "Test dollars" : "USDC";
  return (
    <button
      type="button"
      className={cn("mode-capsule", practice ? "is-practice" : "is-real", className)}
      title={
        practice
          ? "Practice: test dollars on Monad's test network. Switch to Real"
          : "Real: USDC on Monad. Switch to Practice"
      }
      onClick={() => {
        fire("snap", { cue: "toggle" });
        setActiveNetwork(practice ? "mainnet" : "testnet");
      }}
    >
      <EntityMark id={ids.evmChain(network.chainId)} size={CHAIN_MARK} decorative />
      <span className="mode-word">{network.modeLabel}</span>
      <span className="mode-money">· {money}</span>
    </button>
  );
}

/**
 * The balance (opens the wallet drawer; a Practice guest's opens the account drawer, where a passkey keeps its test
 * dollars, R5.10) and the eye that hides every amount on this device.
 */
export function BalanceChip({ className }: { className?: string | undefined }) {
  const trader = useAppTrader();
  const address = trader.owner;
  const account = useMarketAccount(address);
  const hidden = usePrivacy();
  if (!address) return null;
  const balance = "value" in account ? money(account.value.balance) : "—";
  return (
    <span className={cn("balance-chip", className)}>
      <button
        type="button"
        className="balance-amount tnum"
        aria-label={
          trader.guest
            ? `${hidden ? "Balance hidden" : `Balance ${balance}`}. Make a passkey to keep it`
            : hidden
              ? "Balance hidden. Open the wallet"
              : `Balance ${balance}. Open the wallet`
        }
        onClick={() => {
          tapFeedback();
          openDrawer(trader.guest ? DRAWERS.account : DRAWERS.wallet);
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
