"use client";
// D2 "Desk" — pro terminal. Dark default, "stocks and finance" tokens (black / signal green / yellow),
// Inter + JetBrains Mono tabular numerals, 4px radii, hairlines, dense rows, top tab navigation.
import { useState } from "react";
import { ScanFace, Zap, Bell, WifiOff, AlertTriangle, ServerCrash, RefreshCw } from "lucide-react";
import { Phone } from "@/components/shell/phone";
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs";
import BalanceChartPro from "@/components/ui/balance-chart";
import PartitionBar, { PartitionBarSegment, PartitionBarSegmentTitle, PartitionBarSegmentValue } from "@/components/ui/partition-bar";
import MarketWatchlist from "@/components/ui/market-watchlist";
import MarketHeatmap from "@/components/ui/market-heatmap";
import CandleChart from "@/components/ui/candle-chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { Gauge } from "@/components/ui/gauge-1";
import { TaskSteps } from "@/components/ui/task-steps";
import { Button } from "@/components/ui/button";
import { FlippableCreditCard } from "@/components/ui/credit-debit-card";
import UpstashRatelimit from "@/components/ui/upstash-ratelimit";
import { MultiChainSwap } from "@/components/ui/be-ui-multi-chain-swap";
import QRCodeDisplay from "@/components/ui/qr-code-generator";
import { CopyCode } from "@/components/ui/copy-code-button";
import LoadingState from "@/components/ui/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/interactive-empty-state";
import { AlertToast } from "@/components/ui/alert-toast";
import { useQr } from "@/components/adapted/use-qr";
import { balance, markets, positions, cardHolds, depositAddress, fmtUsd } from "@/lib/mock";
import { SectionLabel, type Screen } from "./common";

const TABS = [
  { id: "home", label: "Portfolio" },
  { id: "markets", label: "Markets" },
  { id: "trade", label: "Trade" },
  { id: "card", label: "Card" },
  { id: "fund", label: "Deposit" },
];

function TopBar({ active }: { active: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 pb-1 pt-1">
        <span className="font-mono text-[13px] font-bold tracking-tight">METROPOLIS<span className="text-primary">/</span>DESK</span>
        <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" />MONAD 1s</span>
          <Bell className="size-4" />
        </span>
      </div>
      <div className="px-1 pb-1 [&_*]:text-[13px]">
        <VercelTabs tabs={TABS} activeTab={active} />
      </div>
    </div>
  );
}

const asset = (s: string) => markets.find((m) => m.symbol === s)!;
const Mono = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <span className={`font-mono tnum ${className}`}>{children}</span>;

function HomeScreen() {
  const pct = (n: number) => Math.round((n / balance.total) * 100);
  return (
    <>
      <div className="px-4 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Equity · risk-adjusted</p>
        <p className="mt-1 font-mono text-[34px] font-semibold tracking-tight tnum">{fmtUsd(balance.total)}</p>
        <p className="font-mono text-[12px] text-[var(--up)]">▲ {fmtUsd(balance.pnlToday)} (+{balance.pnlTodayPct}%) 24h</p>
      </div>
      <div className="mt-3 px-2 [&>div]:!max-w-none [&>div]:!border-0 [&>div]:!bg-transparent">
        <BalanceChartPro base={balance.total} />
      </div>
      <div className="mx-4 mt-2 grid grid-cols-3 divide-x divide-border border border-border">
        {[["FREE·TRADE", balance.freeToTrade, "text-primary"], ["FREE·SPEND", balance.freeToSpend, "text-[var(--chart-1)]"], ["LOCKED", balance.locked, "text-muted-foreground"]].map(([k, v, c]) => (
          <div key={k as string} className="p-2.5">
            <p className="font-mono text-[9.5px] tracking-widest text-muted-foreground">{k as string}</p>
            <p className={`font-mono text-[14px] font-semibold tnum ${c}`}>{fmtUsd(v as number, 0)}</p>
          </div>
        ))}
      </div>
      <div className="mx-4 mt-3 [&_*]:!rounded-none">
        <PartitionBar size="sm">
          <PartitionBarSegment num={pct(balance.freeToTrade)}><PartitionBarSegmentTitle className="font-mono text-[10px]">TRADE</PartitionBarSegmentTitle><PartitionBarSegmentValue className="font-mono">{pct(balance.freeToTrade)}%</PartitionBarSegmentValue></PartitionBarSegment>
          <PartitionBarSegment num={pct(balance.freeToSpend)} variant="secondary"><PartitionBarSegmentTitle className="font-mono text-[10px]">SPEND</PartitionBarSegmentTitle><PartitionBarSegmentValue className="font-mono">{pct(balance.freeToSpend)}%</PartitionBarSegmentValue></PartitionBarSegment>
          <PartitionBarSegment num={pct(balance.locked)} variant="outline"><PartitionBarSegmentTitle className="font-mono text-[10px]">LOCK</PartitionBarSegmentTitle><PartitionBarSegmentValue className="font-mono">{pct(balance.locked)}%</PartitionBarSegmentValue></PartitionBarSegment>
        </PartitionBar>
      </div>
      <SectionLabel className="px-4 font-mono">Positions · 2</SectionLabel>
      <div className="mx-4 border border-border">
        <div className="grid grid-cols-[1fr_64px_80px_78px] border-b border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground"><span>MKT</span><span className="text-right">SIZE</span><span className="text-right">LIQ</span><span className="text-right">PNL</span></div>
        {positions.map((p) => (
          <div key={p.symbol} className="grid grid-cols-[1fr_64px_80px_78px] items-center border-b border-border px-3 py-2.5 last:border-0">
            <span><span className="font-mono text-[13px] font-semibold">{p.symbol}-PERP</span><br /><span className={`font-mono text-[10px] ${p.side === "Long" ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{p.side.toUpperCase()} {p.lev}x</span></span>
            <Mono className="text-right text-[12px]">{p.size.toLocaleString()}</Mono>
            <Mono className="text-right text-[12px] text-muted-foreground">{p.liq.toLocaleString()}</Mono>
            <Mono className="text-right text-[12px] text-[var(--up)]">+{p.pnl.toFixed(2)}</Mono>
          </div>
        ))}
      </div>
    </>
  );
}

function MarketsScreen() {
  const [cat, setCat] = useState("all");
  const list = markets.filter((m) => cat === "all" || m.kind.toLowerCase() === cat);
  return (
    <>
      <div className="px-3 pt-3 [&_*]:font-mono [&_*]:text-[11px]">
        <SegmentedControl label="Asset class" value={cat} onValueChange={setCat} options={[{ value: "all", label: "ALL" }, { value: "gold", label: "GOLD" }, { value: "stock", label: "EQUITY" }, { value: "fx", label: "FX" }, { value: "crypto", label: "CRYPTO" }]} />
      </div>
      <div className="px-3 pt-3">
        <MarketWatchlist title="Perps · 24h" initial="XAU" className="!max-w-none !rounded-[var(--radius)]" assets={list.map((m) => ({ symbol: m.symbol, name: `${m.session} · ${m.maxLev}x max`, price: m.price, change: m.change, points: m.spark }))} />
      </div>
      <div className="overflow-hidden px-3 pt-3" style={{ zoom: 0.78 }}>
        <MarketHeatmap title="Heat · by open interest" data={markets.map((m) => ({ sym: m.symbol, name: m.name, cap: m.kind === "Crypto" ? 2.2 : m.kind === "Gold" ? 3.2 : m.kind === "FX" ? 1.2 : 1.8, chg: m.change, price: m.price }))} />
      </div>
    </>
  );
}


function Ticket({ steps }: { steps?: boolean }) {
  const [side, setSide] = useState("long");
  const [lev, setLev] = useState([5]);
  const g = asset("XAU");
  const liq = side === "long" ? g.price * (1 - 0.9 / lev[0]) : g.price * (1 + 0.9 / lev[0]);
  return (
    <>
      <div className="flex items-end justify-between px-4 pt-3">
        <div>
          <p className="font-mono text-[15px] font-bold">XAU-PERP <span className="text-[11px] font-normal text-muted-foreground">GOLD / USD</span></p>
          <p className="font-mono text-[24px] font-semibold tnum">{g.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-[12px] text-[var(--up)]">+{g.change}%</span></p>
        </div>
        <div className="text-right font-mono text-[10px] leading-4 text-muted-foreground">
          <p>FUND <span className="text-foreground">+0.0042%</span></p><p>OI <span className="text-foreground">$18.4M</span></p><p>SESSION <span className="text-primary">OPEN</span></p>
        </div>
      </div>
      <div className="mt-2 border-y border-border [&>div]:!max-w-none [&>div]:!rounded-none [&>div]:!border-0">
        <CandleChart symbol="XAU" exchange="PERPL" mid={g.price} ceil={3000} seed={17} chrome={false} fill />
      </div>
      <div className="grid grid-cols-[1fr_1fr] border-b border-border">
        <div className="border-r border-border p-3">
          <div className="[&_*]:font-mono [&_*]:text-[11px]">
            <SegmentedControl label="Side" value={side} onValueChange={setSide} options={[{ value: "long", label: "LONG" }, { value: "short", label: "SHORT" }]} />
          </div>
          <div className="mt-3 space-y-2 font-mono text-[11px]">
            <label className="block text-muted-foreground">SIZE (USD)<div className="mt-1 border border-border bg-card px-2 py-1.5 text-[14px] text-foreground tnum">1,500.00</div></label>
            <div className="text-muted-foreground">LEVERAGE <span className="float-right text-foreground">{lev[0]}x</span></div>
            <Slider value={lev} onValueChange={setLev} min={1} max={20} step={1} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-2">
          <Gauge value={Math.round(100 - (100 / lev[0]) * 1.1)} size={120} gaugeType="half" primary={{ 0: "var(--up)", 60: "var(--gold)", 85: "var(--down)" }} secondary="var(--muted)" showValue label="MARGIN USE" />
          <p className="-mt-1 font-mono text-[10px] text-muted-foreground">LIQ <span className="text-[var(--down)]">{liq.toFixed(2)}</span></p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 font-mono text-[11px]">
        {[["NOTIONAL", fmtUsd(1500 * lev[0], 0)], ["FEE 0.02%", "$1.50"], ["FROM", "FREE·TRADE"], ["AFTER", fmtUsd(balance.freeToTrade - 1500, 0)]].map(([k, v]) => (
          <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tnum">{v}</dd></div>
        ))}
      </dl>
      <div className="px-4">
        <Button className="h-12 w-full rounded-[var(--radius)] font-mono text-[14px] font-bold"><ScanFace className="size-4" />{side === "long" ? "LONG" : "SHORT"} XAU {lev[0]}x · FACE ID</Button>
      </div>
      {steps && (
        <div className="mx-4 mt-3 border border-primary/40 bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-primary"><Zap className="size-3" />EXECUTION</p>
          <div className="[&_*]:font-mono">
            <TaskSteps label="Order execution" current={3} steps={[{ id: "sig", label: "Face ID · passkey signed", meta: "0.4s" }, { id: "risk", label: "Risk check · one vault", meta: "0.02s" }, { id: "send", label: "Sent to Perpl on Monad", meta: "0.9s" }, { id: "fill", label: "Fill + health update", meta: "…" }]} />
          </div>
        </div>
      )}
    </>
  );
}

function CardScreen() {
  return (
    <>
      <div className="flex justify-center px-4 pt-5">
        <FlippableCreditCard cardholderName="ABU · METROPOLIS" cardNumber="5412 7534 9921 4242" expiryDate="09/29" cvv="•••" />
      </div>
      <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">TAP CARD TO FLIP · VIRTUAL · APPLE PAY READY</p>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <Button className="h-11 rounded-[var(--radius)] font-mono text-[12px]"> PAY · ADD</Button>
        <Button variant="outline" className="h-11 rounded-[var(--radius)] font-mono text-[12px]">FREEZE</Button>
      </div>
      <div className="mx-4 mt-3">
        <UpstashRatelimit size="sm" title="SPEND LIMIT · 24H" limit={1000} remaining={841} reset={Date.now() + 5 * 3600e3} okLabel="from FREE·SPEND" format={(n) => `$${n}`} className="font-mono" />
      </div>
      <SectionLabel className="px-4 font-mono">Authorizations</SectionLabel>
      <div className="mx-4 border border-border font-mono text-[12px]">
        {cardHolds.map((h) => (
          <div key={h.merchant} className="grid grid-cols-[1fr_70px_70px] border-b border-border px-3 py-2.5 last:border-0">
            <span className="truncate">{h.merchant.toUpperCase()}</span>
            <span className={h.status === "Hold" ? "text-[var(--gold)]" : "text-muted-foreground"}>{h.status === "Hold" ? "HOLD" : "SETTLED"}</span>
            <span className="text-right tnum">-{h.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function FundScreen() {
  const qr = useQr(depositAddress, 200, "#000000", "#ffffff");
  return (
    <>
      <SectionLabel className="px-4 font-mono">Bridge + deposit · any chain → AUSD</SectionLabel>
      <div className="px-3 [&>*]:!max-w-none">
        <MultiChainSwap
          defaultFromId="base-usdc"
          defaultToId="mon-ausd"
          chains={[{ id: "base", name: "Base", shortName: "BASE", color: "#0052ff" }, { id: "ethereum", name: "Ethereum", shortName: "ETH", color: "#627eea" }, { id: "solana", name: "Solana", shortName: "SOL", color: "#14f195" }, { id: "monad", name: "Monad", shortName: "MON", color: "#836ef9" }]}
          tokens={[
            { id: "base-usdc", chainId: "base", symbol: "USDC", name: "USD Coin", balance: 2400, usd: 1, icon: "$" },
            { id: "eth-eth", chainId: "ethereum", symbol: "ETH", name: "Ethereum", balance: 0.74, usd: 3412.8, icon: "Ξ" },
            { id: "sol-usdc", chainId: "solana", symbol: "USDC", name: "USD Coin", balance: 860.15, usd: 1, icon: "$" },
            { id: "mon-ausd", chainId: "monad", symbol: "AUSD", name: "Agora USD · Free to trade", balance: 7210.4, usd: 1, icon: "A" },
          ]}
        />
      </div>
      <SectionLabel className="px-4 font-mono">Or send directly</SectionLabel>
      <div className="px-3">
        <QRCodeDisplay data={qr} title="Deposit address · Monad" description="Any EVM chain via intents. Credited to FREE·TRADE." footer={<CopyCode code={depositAddress} display={`${depositAddress.slice(0, 12)}…${depositAddress.slice(-6)}`} className="w-full" />} className="!max-w-none rounded-[var(--radius)] [&_img]:mx-auto [&_img]:max-w-[160px]" />
      </div>
    </>
  );
}

function StatesScreen({ alt }: { alt: boolean }) {
  return (
    <>
      <SectionLabel className="px-4 font-mono">Loading</SectionLabel>
      <div className="mx-4 space-y-2 border border-border p-3">
        <LoadingState label="Syncing positions from Envio" variant="Drive" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_80px] gap-2"><Skeleton className="h-4 rounded-none" /><Skeleton className="h-4 rounded-none" /><Skeleton className="h-4 rounded-none" /></div>
        ))}
      </div>
      <SectionLabel className="px-4 font-mono">Empty</SectionLabel>
      <div className="px-4 [&>div]:!max-w-none">
        <EmptyState theme={alt ? "light" : "dark"} title="No open orders" description="Limit and stop orders you place show up here." icons={[<Zap key="1" />, <Bell key="2" />, <RefreshCw key="3" />]} action={{ label: "New order", onClick: () => {} }} />
      </div>
      <SectionLabel className="px-4 font-mono">Errors & risk events</SectionLabel>
      <div className="space-y-2 px-4">
        <AlertToast className="!text-[var(--down)]" variant="error" styleVariant="default" title="NVDA feed stale · 42s" description="New risk blocked. Reduce-only until the oracle updates." onClose={() => {}} />
        <AlertToast variant="warning" styleVariant="default" title="Margin health 18%" description="XAU-PERP near liquidation. Add funds or reduce." onClose={() => {}} />
        <AlertToast variant="info" styleVariant="default" title="Card declined · $64.00" description="Insufficient FREE·SPEND. Margin untouched." onClose={() => {}} />
      </div>
      <div className="px-4 pt-4 [&>div]:!max-w-none">
        <EmptyState theme={alt ? "light" : "dark"} variant="error" title="Perpl API unreachable" description="Orders are paused. Your positions and card are unaffected." icons={[<WifiOff key="1" />, <AlertTriangle key="2" />, <ServerCrash key="3" />]} action={{ label: "Retry", icon: <RefreshCw className="h-4 w-4" />, onClick: () => {} }} />
      </div>
    </>
  );
}

export function D2({ screen, alt }: { screen: Screen; alt: boolean }) {
  const tab = screen === "confirm" ? "trade" : screen === "states" ? "home" : screen;
  const body = { home: <HomeScreen />, markets: <MarketsScreen />, trade: <Ticket />, confirm: <Ticket steps />, card: <CardScreen />, fund: <FundScreen />, states: <StatesScreen alt={alt} /> }[screen];
  return (
    <Phone theme="d2" dark={!alt} light={alt}>
      <TopBar active={tab} />
      {body}
    </Phone>
  );
}
